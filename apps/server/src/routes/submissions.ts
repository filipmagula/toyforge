import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { recipeSchema, UNTITLED_CHARACTER, validateName, type SubmitResponse } from '@toyforge/shared';
import { touchClass, type ModelRow } from '../db';
import { sendError, WindowCounter } from '../errors';
import { parseBinaryStl } from '../stl';
import { readPngSize } from '../png';
import { findActiveClass } from './classes';

const MB = 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function view(row: ModelRow): SubmitResponse {
  return { id: row.id, makerName: row.maker_name, characterName: row.character_name, createdAt: row.created_at };
}

export async function submissionRoutes(app: FastifyInstance) {
  await app.register(multipart, {
    limits: { fileSize: 10 * MB, files: 2, fields: 6, fieldSize: 32 * 1024, parts: 8 },
  });
  const perClass = new WindowCounter(3_600_000, 300);

  app.post<{ Params: { code: string } }>(
    '/api/classes/:code/models',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const cls = findActiveClass(app, req.params.code);
      if (!cls) return sendError(reply, 404, 'class_not_found', 'Class not found.');

      const fields: Record<string, string> = {};
      const files: Record<string, Buffer> = {};
      if (!req.isMultipart()) return sendError(reply, 400, 'validation', 'Expected multipart/form-data.');
      for await (const part of req.parts()) {
        if (part.type === 'file') {
          const buf = await part.toBuffer();
          if (part.fieldname === 'thumbnail' && buf.length > 2 * MB) return sendError(reply, 413, 'too_large', 'Thumbnail too large.');
          files[part.fieldname] = buf;
        } else {
          fields[part.fieldname] = String(part.value);
        }
      }

      const id = fields.submissionId ?? '';
      if (!UUID.test(id)) return sendError(reply, 400, 'validation', 'Invalid submissionId.');
      const existing = app.db.prepare('SELECT * FROM models WHERE id = ?').get(id) as ModelRow | undefined;
      if (existing) {
        if (existing.class_id !== cls.id) return sendError(reply, 400, 'validation', 'submissionId already used.');
        return reply.code(200).send(view(existing));
      }
      // Checked after the idempotency lookup: a retry of an already-stored model must still succeed.
      if (!cls.is_open) return sendError(reply, 409, 'class_closed', 'This class is not accepting models.');

      const maker = validateName('maker', fields.makerName ?? '');
      if (!maker.ok) return sendError(reply, 400, 'validation', `makerName: ${maker.error}`);
      const character = validateName('character', fields.characterName ?? '');
      if (!character.ok) return sendError(reply, 400, 'validation', `characterName: ${character.error}`);
      let recipeJson: string;
      try {
        const parsed = recipeSchema.safeParse(JSON.parse(fields.recipeJson ?? ''));
        if (!parsed.success) return sendError(reply, 400, 'validation', 'Invalid recipe.');
        recipeJson = JSON.stringify(parsed.data);
      } catch {
        return sendError(reply, 400, 'validation', 'Invalid recipe JSON.');
      }
      const stl = files.stlFile;
      const stlInfo = stl ? parseBinaryStl(stl) : null;
      if (!stl || !stlInfo) return sendError(reply, 400, 'validation', 'Invalid STL file.');
      const png = files.thumbnail;
      const size = png ? readPngSize(png) : null;
      if (!png || !size || size.width > 1024 || size.height > 1024 || size.width < 1 || size.height < 1) {
        return sendError(reply, 400, 'validation', 'Invalid thumbnail.');
      }

      const count = (app.db.prepare('SELECT COUNT(*) n FROM models WHERE class_id = ?').get(cls.id) as { n: number }).n;
      if (count >= app.config.maxModelsPerClass) return sendError(reply, 409, 'class_full', 'This class is full.');
      const now = app.now();
      if (!perClass.hit(cls.id, now.getTime())) return sendError(reply, 429, 'rate_limited', 'Too many models for this class right now.');

      await app.storage.write(cls.id, id, stl, png);
      const row: ModelRow = {
        id,
        class_id: cls.id,
        maker_name: maker.value,
        character_name: character.value || UNTITLED_CHARACTER,
        stl_size_bytes: stl.length,
        triangle_count: stlInfo.triangleCount,
        recipe_json: recipeJson,
        print_status: 'new',
        created_at: now.toISOString(),
      };
      try {
        app.db.transaction(() => {
          app.db
            .prepare(
              `INSERT INTO models (id, class_id, maker_name, character_name, stl_size_bytes, triangle_count, recipe_json, print_status, created_at)
               VALUES (@id, @class_id, @maker_name, @character_name, @stl_size_bytes, @triangle_count, @recipe_json, @print_status, @created_at)`,
            )
            .run(row);
          touchClass(app.db, cls.id, now);
        })();
      } catch (e) {
        // A concurrent upload with the same submissionId won the race: its files are ours too (same id, same model).
        const winner = app.db.prepare('SELECT * FROM models WHERE id = ?').get(id) as ModelRow | undefined;
        if (winner && winner.class_id === cls.id) return reply.code(200).send(view(winner));
        await app.storage.removeModel(cls.id, id);
        throw e;
      }
      return reply.code(201).send(view(row));
    },
  );
}

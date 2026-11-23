import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const UUID = /^[0-9a-f-]{36}$/i;

export class Storage {
  readonly root: string;
  constructor(dataDir: string) {
    this.root = join(dataDir, 'classes');
  }
  private classDir(classId: string): string {
    if (!UUID.test(classId)) throw new Error('bad class id');
    return join(this.root, classId);
  }
  modelPaths(classId: string, modelId: string): { stl: string; png: string } {
    if (!UUID.test(modelId)) throw new Error('bad model id');
    const dir = this.classDir(classId);
    return { stl: join(dir, `${modelId}.stl`), png: join(dir, `${modelId}.png`) };
  }
  async write(classId: string, modelId: string, stl: Buffer, png: Buffer): Promise<void> {
    await mkdir(this.classDir(classId), { recursive: true });
    const p = this.modelPaths(classId, modelId);
    await writeFile(p.stl, stl);
    await writeFile(p.png, png);
  }
  async removeModel(classId: string, modelId: string): Promise<void> {
    const p = this.modelPaths(classId, modelId);
    await rm(p.stl, { force: true });
    await rm(p.png, { force: true });
  }
  async removeClass(classId: string): Promise<void> {
    await rm(this.classDir(classId), { recursive: true, force: true });
  }
  async listClassDirs(): Promise<string[]> {
    try {
      return (await readdir(this.root, { withFileTypes: true })).filter((d) => d.isDirectory() && UUID.test(d.name)).map((d) => d.name);
    } catch {
      return [];
    }
  }
}

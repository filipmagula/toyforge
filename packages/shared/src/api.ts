import type { Recipe } from './recipe';

export type PrintStatus = 'new' | 'queued' | 'printed';
export const PRINT_STATUSES: readonly PrintStatus[] = ['new', 'queued', 'printed'];

export type ErrorCode =
  | 'validation'
  | 'class_not_found'
  | 'class_closed'
  | 'class_full'
  | 'too_large'
  | 'rate_limited'
  | 'unauthorized'
  | 'not_found'
  | 'internal';

export interface ApiError { error: ErrorCode; message: string }

export interface ClassInfo { code: string; name: string; isOpen: boolean }

export interface CreateClassResponse {
  code: string;
  name: string;
  teacherKey: string;
  kidUrl: string;
  teacherUrl: string;
  expiresAt: string;
}

export interface TeacherClass extends ClassInfo {
  createdAt: string;
  expiresAt: string;
  counts: { total: number; new: number; queued: number; printed: number };
}

export interface ModelSummary {
  id: string;
  makerName: string;
  characterName: string;
  printStatus: PrintStatus;
  stlSizeBytes: number;
  triangleCount: number;
  createdAt: string;
  recipe: Recipe;
}

export interface SubmitResponse { id: string; makerName: string; characterName: string; createdAt: string }

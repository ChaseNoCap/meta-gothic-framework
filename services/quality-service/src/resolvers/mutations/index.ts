import { runQualityCheck } from './runQualityCheck.js';
import { applyQualityFix } from './applyQualityFix.js';
import { createQualitySession } from './createQualitySession.js';
import { updateQualityThresholds } from './updateQualityThresholds.js';

export const mutations = {
  runQualityCheck,
  applyQualityFix,
  createQualitySession,
  updateQualityThresholds
};
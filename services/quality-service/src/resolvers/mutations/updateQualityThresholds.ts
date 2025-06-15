import type { GraphQLContext } from '../../graphql/context.js';

interface UpdateThresholdsInput {
  errorThreshold?: number;
  warningThreshold?: number;
  passingScore?: number;
}

export async function updateQualityThresholds(
  _parent: unknown,
  args: { input: UpdateThresholdsInput },
  context: GraphQLContext
) {
  const { errorThreshold, warningThreshold, passingScore } = args.input;
  const { engine } = context;

  try {
    // Get current thresholds from config
    const currentThresholds = await engine.getQualityThresholds();
    
    // Update thresholds
    const newThresholds = {
      errorThreshold: errorThreshold ?? currentThresholds.errorThreshold,
      warningThreshold: warningThreshold ?? currentThresholds.warningThreshold,
      passingScore: passingScore ?? currentThresholds.passingScore
    };
    
    // Save updated thresholds
    await engine.updateQualityThresholds(newThresholds);
    
    return newThresholds;
  } catch (error) {
    console.error('Error updating quality thresholds:', error);
    throw new Error('Failed to update quality thresholds');
  }
}
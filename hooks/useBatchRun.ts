import { useCallback, useState } from 'react';
import { BatchRunProgressState } from '../components/BatchRunProgressModal';
import { ioService } from '../services/ioService';
import { stringifyRowsAsCsv } from '../services/variableTableService';
import { Project, Template } from '../types';

const createEmptyBatchRunProgress = (): BatchRunProgressState => ({
  isOpen: false,
  isRunning: false,
  templateId: null,
  templateName: '',
  stepId: null,
  stepName: '',
  total: 0,
  processed: 0,
  successCount: 0,
  failures: [],
  results: [],
});

interface UseBatchRunOptions {
  projects: Project[];
  templates: Template[];
  executeProjectStep: (projectId: string, stepId: string) => Promise<string>;
  openAlert: (title: string, message: string) => void;
}

export const useBatchRun = ({
  projects,
  templates,
  executeProjectStep,
  openAlert,
}: UseBatchRunOptions) => {
  const [batchRunProgress, setBatchRunProgress] = useState<BatchRunProgressState>(createEmptyBatchRunProgress());

  const runBatchStepWithProgress = useCallback(
    async (projectIds: string[], templateId: string, stepId: string) => {
      const template = templates.find((item) => item.id === templateId);
      const step = template?.steps.find((item) => item.id === stepId);
      if (!template || !step) {
        openAlert('Run failed', 'The selected template step could not be found.');
        return;
      }

      let successCount = 0;
      const failures: BatchRunProgressState['failures'] = [];
      const results: BatchRunProgressState['results'] = [];

      setBatchRunProgress({
        isOpen: true,
        isRunning: true,
        templateId,
        templateName: template.name,
        stepId,
        stepName: step.name,
        total: projectIds.length,
        processed: 0,
        successCount: 0,
        failures: [],
        results: [],
      });

      for (let index = 0; index < projectIds.length; index += 1) {
        const projectId = projectIds[index];
        const project = projects.find((item) => item.id === projectId);

        if (!project) {
          const message = 'Project not found.';
          failures.push({
            projectId,
            projectName: projectId,
            message,
          });
          results.push({
            projectId,
            projectName: projectId,
            status: 'error',
            message,
          });
        } else {
          try {
            await executeProjectStep(project.id, stepId);
            successCount += 1;
            results.push({
              projectId: project.id,
              projectName: project.name,
              status: 'success',
              message: 'Completed successfully.',
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Run failed.';
            failures.push({
              projectId: project.id,
              projectName: project.name,
              message,
            });
            results.push({
              projectId: project.id,
              projectName: project.name,
              status: 'error',
              message,
            });
          }
        }

        setBatchRunProgress((prev) => ({
          ...prev,
          processed: index + 1,
          successCount,
          failures: [...failures],
          results: [...results],
        }));
      }

      setBatchRunProgress((prev) => ({
        ...prev,
        isRunning: false,
        processed: projectIds.length,
        successCount,
        failures: [...failures],
        results: [...results],
      }));
    },
    [executeProjectStep, openAlert, projects, templates]
  );

  const handleBatchRunStepWithProgress = useCallback(
    async (templateId: string, stepId: string) => {
      const matchedProjectIds = projects
        .filter((project) => project.templateId === templateId && !project.archived)
        .map((project) => project.id);

      if (matchedProjectIds.length === 0) {
        openAlert('No runnable projects', 'This template has no unarchived projects available for batch run.');
        return;
      }

      await runBatchStepWithProgress(matchedProjectIds, templateId, stepId);
    },
    [openAlert, projects, runBatchStepWithProgress]
  );

  const handleRetryFailedBatchRun = useCallback(async () => {
    if (!batchRunProgress.templateId || !batchRunProgress.stepId || batchRunProgress.failures.length === 0) {
      return;
    }

    await runBatchStepWithProgress(
      batchRunProgress.failures.map((failure) => failure.projectId),
      batchRunProgress.templateId,
      batchRunProgress.stepId
    );
  }, [batchRunProgress, runBatchStepWithProgress]);

  const handleCloseBatchRunProgress = useCallback(() => {
    setBatchRunProgress((prev) => (prev.isRunning ? prev : createEmptyBatchRunProgress()));
  }, []);

  const handleExportBatchRunResults = useCallback(
    async (format: 'json' | 'csv', scope: 'all' | 'success' | 'error') => {
      const filteredResults =
        scope === 'all'
          ? batchRunProgress.results
          : batchRunProgress.results.filter((item) => item.status === scope);

      if (filteredResults.length === 0) {
        openAlert('Nothing to export', 'There are no results to export for the current filter.');
        return;
      }

      const rows = filteredResults.map((item) => ({
        template_name: batchRunProgress.templateName,
        step_name: batchRunProgress.stepName,
        project_id: item.projectId,
        project_name: item.projectName,
        status: item.status,
        message: item.message,
      }));

      const safeTemplateName = (batchRunProgress.templateName || 'batch_run').replace(/[\\/:*?"<>|]+/g, '_');
      const safeStepName = (batchRunProgress.stepName || 'step').replace(/[\\/:*?"<>|]+/g, '_');
      const scopeSuffix = scope === 'all' ? 'all' : scope;

      if (format === 'json') {
        await ioService.exportFile(
          `${safeTemplateName}_${safeStepName}_${scopeSuffix}.json`,
          JSON.stringify(rows, null, 2),
          'application/json'
        );
        return;
      }

      await ioService.exportFile(
        `${safeTemplateName}_${safeStepName}_${scopeSuffix}.csv`,
        stringifyRowsAsCsv(rows),
        'text/csv'
      );
    },
    [batchRunProgress, openAlert]
  );

  return {
    batchRunProgress,
    handleBatchRunStepWithProgress,
    handleRetryFailedBatchRun,
    handleCloseBatchRunProgress,
    handleExportBatchRunResults,
  };
};

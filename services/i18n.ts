import { UiLanguage } from '../types';

type TranslationKey =
  | 'project.untitled'
  | 'project.template'
  | 'project.id'
  | 'project.compact'
  | 'project.detail'
  | 'project.clearLogs'
  | 'project.clearLogsTitle'
  | 'project.clearLogsMessage'
  | 'project.updateProducers'
  | 'project.producerPreflightTitle'
  | 'project.producerPreflightSubtitle'
  | 'project.producerReady'
  | 'project.producerBlocked'
  | 'project.producerExisting'
  | 'project.producerOverwriteAll'
  | 'project.producerSkipAll'
  | 'project.producerStart'
  | 'project.producerNothingToRun'
  | 'project.producerResultTitle'
  | 'project.producerStop'
  | 'project.producerStopping'
  | 'project.producerCurrent'
  | 'project.producerProgress'
  | 'project.producerSkipped'
  | 'project.producerStopped'
  | 'project.producerWillOverwrite'
  | 'project.producerOutputVar'
  | 'project.producerBlockedReason'
  | 'project.producerNoReady'
  | 'project.producerSummary'
  | 'project.producerScope'
  | 'project.producerScopeEmpty'
  | 'project.producerScopeChanged'
  | 'project.producerScopeAll'
  | 'project.liveOutline'
  | 'project.show'
  | 'project.hide'
  | 'project.doubleClickToCopy'
  | 'step.manual'
  | 'step.manualMessage'
  | 'step.missingRef'
  | 'step.missingRefMessage'
  | 'step.missingModel'
  | 'step.missingModelMessage'
  | 'step.modelOff'
  | 'step.modelOffMessage'
  | 'step.missingProvider'
  | 'step.missingProviderMessage'
  | 'step.providerOff'
  | 'step.providerOffMessage'
  | 'step.missingKey'
  | 'step.missingKeyMessage'
  | 'step.unsupported'
  | 'step.unsupportedMessage'
  | 'step.runnable'
  | 'step.runnableMessage'
  | 'step.unknown'
  | 'step.unknownMessage'
  | 'step.synced'
  | 'step.stale'
  | 'step.draft'
  | 'step.empty'
  | 'step.running'
  | 'step.done'
  | 'step.failed'
  | 'step.idle'
  | 'step.missingVars'
  | 'step.staleDeps'
  | 'step.copy'
  | 'step.generate'
  | 'step.model'
  | 'step.provider'
  | 'step.temperature'
  | 'step.maxTokens'
  | 'step.default'
  | 'step.systemPrompt'
  | 'step.notSet'
  | 'step.unbound'
  | 'step.prompt'
  | 'step.outputVar'
  | 'step.source'
  | 'step.missing'
  | 'step.staleLabel'
  | 'step.result'
  | 'step.resultHint'
  | 'step.resultPlaceholder'
  | 'step.clear'
  | 'step.runLogs'
  | 'step.summaryView'
  | 'step.detailView'
  | 'step.logCount'
  | 'step.noRunLogs'
  | 'step.showHistory'
  | 'step.hideHistory'
  | 'step.clearStepLogs'
  | 'step.clearStepLogsTitle'
  | 'step.clearStepLogsMessage'
  | 'step.latestResult'
  | 'step.latestError'
  | 'step.copySystem'
  | 'step.copyUser'
  | 'step.copyResult'
  | 'step.copyError'
  | 'step.restoreResult'
  | 'step.userPrompt'
  | 'step.output'
  | 'step.error'
  | 'step.emptyText'
  | 'step.roleText'
  | 'step.roleManual'
  | 'step.roleExternal'
  | 'step.autoRun'
  | 'step.autoRunOff'
  | 'step.roleInfo'
  | 'step.autoRunInfo'
  | 'step.autoQueued'
  | 'step.autoBlocked'
  | 'step.autoSkipped'
  | 'step.autoStopped'
  | 'step.autoStateInfo'
  | 'step.structuredParsing'
  | 'step.structuredAwaitingConfirm'
  | 'step.structuredUpdated'
  | 'step.structuredSkipped'
  | 'step.structuredFailed'
  | 'step.structuredOverwriteTitle'
  | 'step.structuredOverwriteTitleAutomation'
  | 'step.structuredOverwriteMessage'
  | 'step.structuredOverwriteMessageAutomation'
  | 'step.structuredSkipParse'
  | 'step.structuredOverwriteAndParse'
  | 'toast.copied'
  | 'toast.restored'
  | 'toast.generated'
  | 'toast.result'
  | 'toast.systemPrompt'
  | 'toast.userPrompt'
  | 'toast.error'
  | 'editor.edited'
  | 'editor.syncTemplate'
  | 'editor.revert'
  | 'editor.editing'
  | 'editor.waiting'
  | 'editor.saveTitle'
  | 'editor.saveMessage'
  | 'settings.language'
  | 'settings.languageZh'
  | 'settings.languageEn'
  | 'sidebar.vars'
  | 'sidebar.nav'
  | 'sidebar.build'
  | 'sidebar.importVarTable'
  | 'sidebar.exportJson'
  | 'sidebar.exportCsv'
  | 'sidebar.inputVars'
  | 'sidebar.localVars'
  | 'sidebar.resultVars'
  | 'sidebar.duplicateVar'
  | 'sidebar.duplicateVarMessage'
  | 'sidebar.varNamePlaceholder'
  | 'sidebar.cancel'
  | 'sidebar.add'
  | 'sidebar.addLocalVar'
  | 'sidebar.noResultVars'
  | 'sidebar.stepSource'
  | 'sidebar.sourceType'
  | 'sidebar.copyVar'
  | 'sidebar.goSource'
  | 'sidebar.bakeTitle'
  | 'sidebar.bakeDescription'
  | 'sidebar.startExport'
  | 'sidebar.openProjectFirst'
  | 'fileLibrary.title'
  | 'fileLibrary.subtitle'
  | 'fileLibrary.restoreAll'
  | 'fileLibrary.backupData'
  | 'fileLibrary.mergeData'
  | 'fileLibrary.assetsTitle'
  | 'fileLibrary.visibleProjects'
  | 'fileLibrary.batchManage'
  | 'fileLibrary.exitManage'
  | 'fileLibrary.showArchived'
  | 'fileLibrary.searchTags'
  | 'fileLibrary.scale'
  | 'fileLibrary.grouped'
  | 'fileLibrary.flat'
  | 'fileLibrary.sortByModified'
  | 'fileLibrary.sortByCreated'
  | 'fileLibrary.sortByName'
  | 'fileLibrary.noVisibleAssets'
  | 'fileLibrary.quickCreate'
  | 'fileLibrary.newTemplate'
  | 'fileLibrary.batchInstantiate'
  | 'fileLibrary.selectTemplate'
  | 'fileLibrary.batchCreate'
  | 'fileLibrary.batchRun'
  | 'fileLibrary.useTemplate'
  | 'fileLibrary.editTemplate'
  | 'fileLibrary.selected'
  | 'fileLibrary.selectAll'
  | 'fileLibrary.clearAll'
  | 'fileLibrary.batchDelete'
  | 'fileLibrary.ungroupedProjects'
  | 'fileLibrary.importFailed'
  | 'fileLibrary.importEmpty'
  | 'fileLibrary.importInvalidJson'
  | 'fileLibrary.importInvalidBundle'
  | 'fileLibrary.importReadFailed'
  | 'fileLibrary.missingTemplate'
  | 'fileLibrary.created'
  | 'fileLibrary.modified'
  | 'fileLibrary.unarchive'
  | 'fileLibrary.archive'
  | 'fileLibrary.extractTemplate'
  | 'fileLibrary.deleteForever'
  | 'fileLibrary.projectCount'
  | 'fileLibrary.noVisibleAssetsHint'
  | 'fileLibrary.showTemplateAssets'
  | 'fileLibrary.hideTemplateAssets'
  | 'fileLibrary.duplicateTemplate'
  | 'fileLibrary.deleteTemplate'
  | 'fileLibrary.cancel'
  | 'templateEditor.title'
  | 'templateEditor.cancel'
  | 'templateEditor.save'
  | 'templateEditor.name'
  | 'templateEditor.tags'
  | 'templateEditor.addTag'
  | 'templateEditor.inputSection'
  | 'templateEditor.modelRefSection'
  | 'templateEditor.stepsSection'
  | 'templateEditor.add'
  | 'templateEditor.inputHelp'
  | 'templateEditor.inputName'
  | 'templateEditor.modelRefHelp'
  | 'templateEditor.noModelRef'
  | 'templateEditor.modelRefName'
  | 'templateEditor.unboundModel'
  | 'templateEditor.missingModelItem'
  | 'templateEditor.disabledModelItem'
  | 'templateEditor.selectAllSteps'
  | 'templateEditor.selectByModelRef'
  | 'templateEditor.selectSameModelRef'
  | 'templateEditor.selectedSteps'
  | 'templateEditor.applyCopiedConfig'
  | 'templateEditor.clearSelection'
  | 'templateEditor.stepName'
  | 'templateEditor.description'
  | 'templateEditor.optionalDescription'
  | 'templateEditor.promptContent'
  | 'templateEditor.promptPlaceholder'
  | 'templateEditor.modelRef'
  | 'templateEditor.manualStepHint'
  | 'templateEditor.currentPreset'
  | 'templateEditor.executionPreset'
  | 'templateEditor.clearPreset'
  | 'templateEditor.presetHelp'
  | 'templateEditor.noModelRefOption'
  | 'templateEditor.disabledSuffix'
  | 'templateEditor.missingSuffix'
  | 'templateEditor.recommendedPreset'
  | 'templateEditor.recommendedPresetAuto'
  | 'templateEditor.recommendedPresetManual'
  | 'templateEditor.executionStatus'
  | 'templateEditor.statusNote'
  | 'templateEditor.defaultPlaceholder'
  | 'templateEditor.currentTemplate'
  | 'templateEditor.recommendedTemplate'
  | 'templateEditor.systemPromptAuto'
  | 'templateEditor.systemPromptManual'
  | 'templateEditor.clearTemplate'
  | 'templateEditor.systemPromptPlaceholder'
  | 'templateEditor.outputToVar'
  | 'templateEditor.bindingHelp'
  | 'templateEditor.varKey'
  | 'templateEditor.displayName'
  | 'templateEditor.bindingKnown'
  | 'templateEditor.bindingNew'
  | 'templateEditor.addStep'
  | 'templateEditor.defaultModelRefLabel'
  | 'templateEditor.deleteInputTitle'
  | 'templateEditor.deleteInputMessage'
  | 'templateEditor.deleteModelRefTitle'
  | 'templateEditor.deleteModelRefMessage'
  | 'templateEditor.deleteStepTitle'
  | 'templateEditor.deleteStepMessage'
  | 'templateEditor.untitledStep'
  | 'templateEditor.selectStep'
  | 'templateEditor.unselectStep'
  | 'templateEditor.copiedExecutionConfig'
  | 'templateEditor.moveUp'
  | 'templateEditor.moveDown'
  | 'templateEditor.deleteStep'
  | 'templateEditor.delete'
  | 'templateEditor.copyExecutionConfig'
  | 'templateEditor.applyCopiedConfigFrom'
  | 'templateEditor.moreActions'
  | 'templateEditor.executionSummary'
  | 'templateEditor.expandExecution'
  | 'templateEditor.collapseExecution'
  | 'templateEditor.bindingSummaryUnbound'
  | 'templateEditor.bindingSummaryBound'
  | 'templateEditor.expandBinding'
  | 'templateEditor.collapseBinding'
  | 'templateEditor.executionTemplateSelect'
  | 'templateEditor.applyExecutionTemplate'
  | 'templateEditor.saveAsPreset'
  | 'templateEditor.stepType'
  | 'templateEditor.stepTypeText'
  | 'templateEditor.stepTypeManual'
  | 'templateEditor.stepTypeExternal'
  | 'templateEditor.stepTypeHelpText'
  | 'templateEditor.stepTypeHelpManual'
  | 'templateEditor.stepTypeHelpExternal'
  | 'templateEditor.autoRunEnabled'
  | 'templateEditor.autoRunHelp'
  | 'templateEditor.autoRunDisabledHelp'
  | 'templateEditor.presetName'
  | 'templateEditor.presetDescription'
  | 'templateEditor.modelStrategy'
  | 'templateEditor.keepCurrentModel'
  | 'templateEditor.bindCurrentCatalogModel'
  | 'templateEditor.presetSaveHintBound'
  | 'templateEditor.presetSaveHintKeep'
  | 'templateEditor.presetSaveHintNoModel'
  | 'templateEditor.savePreset'
  | 'templateEditor.viewList'
  | 'templateEditor.viewBlueprint'
  | 'templateEditor.blueprintAutoLayout'
  | 'templateEditor.blueprintConnect'
  | 'templateEditor.blueprintZoom'
  | 'templateEditor.blueprintConnectFailed';

type TranslationValue = string | ((params: Record<string, string | number>) => string);

const messages: Record<UiLanguage, Partial<Record<TranslationKey, TranslationValue>>> = {
  'zh-CN': {
    'project.untitled': '未命名项目',
    'project.template': '模板',
    'project.id': 'ID',
    'project.compact': '紧凑',
    'project.detail': '详细',
    'project.clearLogs': '清空日志',
    'project.clearLogsTitle': '清空项目日志',
    'project.clearLogsMessage': '清空这个项目的全部运行日志？步骤结果会保留。',
    'project.liveOutline': '实时结果总览',
    'project.show': '展开',
    'project.hide': '收起',
    'project.doubleClickToCopy': '双击复制',
    'step.manual': '手动',
    'step.manualMessage': '这个步骤没有绑定模型引用，会按手动步骤处理。',
    'step.missingRef': '缺引用',
    'step.missingRefMessage': '这个步骤配置了模型引用，但引用本身已经找不到了。',
    'step.missingModel': '缺模型',
    'step.missingModelMessage': '当前模型引用还没有绑定到模型目录项。',
    'step.modelOff': '模型停用',
    'step.modelOffMessage': '当前绑定的模型目录项已被禁用。',
    'step.missingProvider': '缺提供商',
    'step.missingProviderMessage': '当前模型目录项指向的提供商已经不存在。',
    'step.providerOff': '提供商停用',
    'step.providerOffMessage': '当前绑定的提供商已被禁用。',
    'step.missingKey': '缺 Key',
    'step.missingKeyMessage': '当前提供商还没有配置 API Key。',
    'step.unsupported': '暂不支持',
    'step.unsupportedMessage': '这个提供商类型当前还不能在这里执行。',
    'step.runnable': '可执行',
    'step.runnableMessage': ({ provider, model }) => `将使用 ${provider} / ${model} 执行。`,
    'step.unknown': '未知',
    'step.unknownMessage': '当前步骤的执行状态未知。',
    'step.synced': '已同步',
    'step.stale': '待更新',
    'step.draft': '草稿',
    'step.empty': '空白',
    'step.running': '执行中',
    'step.done': '完成',
    'step.failed': '失败',
    'step.idle': '空闲',
    'step.missingVars': ({ count }) => `缺变量 ${count}`,
    'step.staleDeps': ({ count }) => `依赖待更新 ${count}`,
    'step.copy': '复制',
    'step.generate': '生成',
    'step.model': '模型',
    'step.provider': '提供商',
    'step.temperature': 'Temperature',
    'step.maxTokens': 'Max Tokens',
    'step.default': '默认',
    'step.systemPrompt': 'System Prompt',
    'step.notSet': '未设置',
    'step.unbound': '未绑定',
    'step.prompt': '提示词',
    'step.outputVar': '输出变量',
    'step.source': '来源',
    'step.missing': '缺失',
    'step.staleLabel': '待更新',
    'step.result': '步骤结果',
    'step.resultHint': "支持 [[step]] / {{var}}",
    'step.resultPlaceholder': '这里可以存放生成结果、人工备注或后续要复用的文本...',
    'step.clear': '清空',
    'step.runLogs': '运行记录',
    'step.summaryView': '摘要视图',
    'step.detailView': '详细视图',
    'step.logCount': ({ count }) => `${count} 条记录`,
    'step.noRunLogs': '还没有运行记录。',
    'step.showHistory': '展开历史',
    'step.hideHistory': '收起历史',
    'step.clearStepLogs': '清空日志',
    'step.clearStepLogsTitle': '清空步骤日志',
    'step.clearStepLogsMessage': '清空这个步骤的运行日志？步骤结果会保留。',
    'step.latestResult': ({ text }) => `最近结果：${text}`,
    'step.latestError': ({ text }) => `最近错误：${text}`,
    'step.copySystem': '复制 System',
    'step.copyUser': '复制 User',
    'step.copyResult': '复制结果',
    'step.copyError': '复制错误',
    'step.restoreResult': '恢复结果',
    'step.userPrompt': 'User Prompt',
    'step.output': '输出',
    'step.error': '错误',
    'step.emptyText': '空',
    'step.roleText': '文本',
    'step.roleManual': '人工',
    'step.roleExternal': '外部',
    'step.autoRun': '自动',
    'step.autoRunOff': '手动',
    'step.roleInfo': ({ role }) => `步骤类型：${role}`,
    'step.autoRunInfo': ({ status }) => `自动执行：${status}`,
    'toast.copied': ({ label }) => `${label}已复制`,
    'toast.restored': '已恢复',
    'toast.generated': '已生成',
    'toast.result': '结果',
    'toast.systemPrompt': 'System Prompt',
    'toast.userPrompt': 'User Prompt',
    'toast.error': '错误',
    'editor.edited': '已改写',
    'editor.syncTemplate': '同步模板',
    'editor.revert': '还原',
    'editor.editing': '编辑原文',
    'editor.waiting': '等待输入或变量替换后显示内容...',
    'editor.saveTitle': '同步到模板',
    'editor.saveMessage': '把当前项目里的局部改写写回模板？这会影响使用这个模板的所有项目。',
    'settings.language': '语言',
    'settings.languageZh': '中文',
    'settings.languageEn': 'English',
    'sidebar.vars': '变量配置',
    'sidebar.nav': '步骤导航',
    'sidebar.build': '导出烘焙',
    'sidebar.importVarTable': '导入变量表',
    'sidebar.exportJson': '导出 JSON',
    'sidebar.exportCsv': '导出 CSV',
    'sidebar.inputVars': '输入变量',
    'sidebar.localVars': '局部变量',
    'sidebar.resultVars': '结果变量',
    'sidebar.duplicateVar': '无法复制',
    'sidebar.duplicateVarMessage': '这个变量当前没有内容可复制。',
    'sidebar.varNamePlaceholder': '名称...',
    'sidebar.cancel': '取消',
    'sidebar.add': '添加',
    'sidebar.addLocalVar': '+ 新增局部变量',
    'sidebar.noResultVars': '暂无结果变量。',
    'sidebar.stepSource': '来源步骤',
    'sidebar.sourceType': '来源类型',
    'sidebar.copyVar': '复制变量值',
    'sidebar.goSource': '跳到来源步骤',
    'sidebar.bakeTitle': '提示词全量烘焙',
    'sidebar.bakeDescription': '一键合并所有步骤内容并导出为 .txt 纯文本。',
    'sidebar.startExport': '开始导出',
    'sidebar.openProjectFirst': '请先从库中打开项目',
    'fileLibrary.title': '文件库',
    'fileLibrary.subtitle': '本地项目管理器',
    'fileLibrary.restoreAll': '全量恢复',
    'fileLibrary.backupData': '备份数据',
    'fileLibrary.mergeData': '合并数据',
    'fileLibrary.assetsTitle': '我的项目资产',
    'fileLibrary.visibleProjects': ({ count }) => `${count} 个可见项目`,
    'fileLibrary.batchManage': '批量管理',
    'fileLibrary.exitManage': '退出管理',
    'fileLibrary.showArchived': '显示已归档',
    'fileLibrary.searchTags': '搜索标签...',
    'fileLibrary.scale': '缩放',
    'fileLibrary.grouped': '已分组',
    'fileLibrary.flat': '平铺',
    'fileLibrary.sortByModified': '修改时间',
    'fileLibrary.sortByCreated': '创建时间',
    'fileLibrary.sortByName': '名称',
    'fileLibrary.noVisibleAssets': '未发现可见资产',
    'fileLibrary.quickCreate': '快速创建',
    'fileLibrary.newTemplate': '新建模板',
    'fileLibrary.batchInstantiate': '批量实例化',
    'fileLibrary.selectTemplate': '选择模板',
    'fileLibrary.batchCreate': '批量创建',
    'fileLibrary.batchRun': '批量执行',
    'fileLibrary.useTemplate': '使用模板',
    'fileLibrary.editTemplate': '编辑',
    'fileLibrary.selected': '已选择',
    'fileLibrary.selectAll': '全选所有',
    'fileLibrary.clearAll': '取消全选',
    'fileLibrary.batchDelete': '批量删除',
    'fileLibrary.ungroupedProjects': '未分类项目',
    'fileLibrary.importFailed': '失败',
    'fileLibrary.importEmpty': '所选文件为空。',
    'fileLibrary.importInvalidJson': '文件内容不是有效的 JSON。',
    'fileLibrary.importInvalidBundle': ({ error }) => `文件格式校验不通过：${error}`,
    'fileLibrary.importReadFailed': '文件读取或解析 JSON 失败。',
    'fileLibrary.missingTemplate': '已失效',
    'fileLibrary.created': '创建',
    'fileLibrary.modified': '最后修改',
    'fileLibrary.unarchive': '取消归档',
    'fileLibrary.archive': '归档项目',
    'fileLibrary.extractTemplate': '提取模板',
    'fileLibrary.deleteForever': '彻底删除',
    'fileLibrary.projectCount': ({ count }) => `${count} 个项目`,
    'fileLibrary.noVisibleAssetsHint': '当前过滤条件下无项目显示。请检查右侧模板卡片上的眼睛图标是否已关闭。',
    'fileLibrary.showTemplateAssets': '显示该模板下的资产',
    'fileLibrary.hideTemplateAssets': '隐藏该模板下的资产',
    'fileLibrary.duplicateTemplate': '复制模板',
    'fileLibrary.deleteTemplate': '删除模板',
    'fileLibrary.cancel': '取消',
    'templateEditor.title': '编辑模板',
    'templateEditor.cancel': '取消',
    'templateEditor.save': '保存模板',
    'templateEditor.name': '模板名称',
    'templateEditor.tags': '标签',
    'templateEditor.addTag': '添加标签...',
    'templateEditor.inputSection': '1. 输入变量',
    'templateEditor.modelRefSection': '2. 模型引用',
    'templateEditor.stepsSection': '3. 流程步骤',
    'templateEditor.add': '+ 添加',
    'templateEditor.inputHelp': '模板里可以继续用 <序号>、<变量名> 或 {{variable_key}} 引用上下文。',
    'templateEditor.inputName': '变量名称',
    'templateEditor.modelRefHelp': '这里定义模板可用的模型引用。步骤里只选择引用，不直接配置 provider 或 API。',
    'templateEditor.noModelRef': '还没有模型引用。不选择模型引用的步骤，默认就是手动步骤。',
    'templateEditor.modelRefName': '模型引用名称',
    'templateEditor.unboundModel': '不绑定具体模型',
    'templateEditor.missingModelItem': '当前绑定的模型目录项不存在。',
    'templateEditor.disabledModelItem': '当前绑定的模型目录项已禁用。',
    'templateEditor.selectAllSteps': '全选步骤',
    'templateEditor.selectByModelRef': '按模型引用选中',
    'templateEditor.selectSameModelRef': '选中同引用步骤',
    'templateEditor.selectedSteps': ({ count }) => `已选中 ${count} 个步骤`,
    'templateEditor.applyCopiedConfig': '批量应用已复制配置',
    'templateEditor.clearSelection': '清空选择',
    'templateEditor.stepName': '步骤名称',
    'templateEditor.description': '描述',
    'templateEditor.optionalDescription': '可选描述',
    'templateEditor.promptContent': '提示词模板内容',
    'templateEditor.promptPlaceholder': '编写提示词，例如：根据 {{topic}} 生成内容...',
    'templateEditor.modelRef': '模型引用',
    'templateEditor.manualStepHint': '这里只选模板里定义好的模型引用。不选就表示这个步骤继续按手动步骤处理。',
    'templateEditor.currentPreset': '当前预设',
    'templateEditor.executionPreset': 'DeepSeek 参数预设',
    'templateEditor.clearPreset': '清空为默认',
    'templateEditor.presetHelp': '预设会填充下面的 Temperature 和 Max Tokens，之后仍可手动微调。',
    'templateEditor.noModelRefOption': '不使用模型引用',
    'templateEditor.disabledSuffix': ' [已禁用]',
    'templateEditor.missingSuffix': ' [缺失]',
    'templateEditor.recommendedPreset': '推荐预设',
    'templateEditor.recommendedPresetAuto': '，首次绑定会自动带入。',
    'templateEditor.recommendedPresetManual': '，当前参数已手动设置，不会自动覆盖。',
    'templateEditor.executionStatus': '执行状态',
    'templateEditor.statusNote': '状态说明',
    'templateEditor.defaultPlaceholder': '留空使用默认值',
    'templateEditor.currentTemplate': '当前模板',
    'templateEditor.recommendedTemplate': '推荐模板',
    'templateEditor.systemPromptAuto': '，首次绑定会自动带入。',
    'templateEditor.systemPromptManual': '，当前内容已手动设置，不会自动覆盖。',
    'templateEditor.clearTemplate': '清空模板',
    'templateEditor.systemPromptPlaceholder': '例如：把中文需求整理成适合该模型执行的提示词。',
    'templateEditor.outputToVar': '输出到变量',
    'templateEditor.bindingHelp': '变量 key 为空就表示不绑定。配置后，这个步骤的结果可以写入对应变量。',
    'templateEditor.varKey': '变量 Key',
    'templateEditor.displayName': '显示名',
    'templateEditor.bindingKnown': '当前 key 已存在于模板上下文中。',
    'templateEditor.bindingNew': '当前 key 还不存在，将创建新的输出变量。',
    'templateEditor.addStep': '添加新步骤',
    'templateEditor.defaultModelRefLabel': ({ count }) => `模型引用 ${count}`,
    'templateEditor.deleteInputTitle': '删除输入变量',
    'templateEditor.deleteInputMessage': '确认删除这个输入变量吗？依赖它的步骤占位符需要你手动调整。',
    'templateEditor.deleteModelRefTitle': '删除模型引用',
    'templateEditor.deleteModelRefMessage': '确认删除这个模型引用吗？引用它的步骤会退回为手动步骤。',
    'templateEditor.deleteStepTitle': '删除步骤',
    'templateEditor.deleteStepMessage': '确认删除这个步骤吗？',
    'templateEditor.untitledStep': '未命名步骤',
    'templateEditor.selectStep': '选择步骤',
    'templateEditor.unselectStep': '取消选择步骤',
    'templateEditor.copiedExecutionConfig': '已复制执行配置',
    'templateEditor.moveUp': '上移',
    'templateEditor.moveDown': '下移',
    'templateEditor.deleteStep': '删除步骤',
    'templateEditor.delete': '删',
    'templateEditor.copyExecutionConfig': '复制执行配置',
    'templateEditor.applyCopiedConfigFrom': ({ stepName }) => `应用来自 ${stepName} 的执行配置`,
    'templateEditor.moreActions': '更多',
    'templateEditor.executionSummary': '执行配置',
    'templateEditor.expandExecution': '展开执行配置',
    'templateEditor.collapseExecution': '收起执行配置',
    'templateEditor.bindingSummaryUnbound': '未绑定输出变量',
    'templateEditor.bindingSummaryBound': ({ key }) => `输出同步到 {{${key}}}`,
    'templateEditor.expandBinding': '展开变量配置',
    'templateEditor.collapseBinding': '收起变量配置',
    'templateEditor.executionTemplateSelect': '选择执行模板',
    'templateEditor.applyExecutionTemplate': '应用执行模板',
    'templateEditor.saveAsPreset': '保存当前配置为模板',
    'templateEditor.stepType': '步骤类型',
    'templateEditor.stepTypeText': '文本生成',
    'templateEditor.stepTypeManual': '人工确认',
    'templateEditor.stepTypeExternal': '外部执行',
    'templateEditor.stepTypeHelpText': '适合语言模型自动批量执行。',
    'templateEditor.stepTypeHelpManual': '自动流程到这里必须停下，由用户人工确认或编辑。',
    'templateEditor.stepTypeHelpExternal': '当前只生成提示词，不自动调用图像或视频模型。',
    'templateEditor.autoRunEnabled': '允许自动执行',
    'templateEditor.autoRunHelp': '只有文本生成步骤才会进入后续半自动执行范围。',
    'templateEditor.autoRunDisabledHelp': '只有文本生成步骤可以开启自动执行。',
    'templateEditor.presetName': '模板名称',
    'templateEditor.presetDescription': '备注',
    'templateEditor.modelStrategy': '模型策略',
    'templateEditor.keepCurrentModel': '保留当前模型',
    'templateEditor.bindCurrentCatalogModel': '记录当前模型目录项',
    'templateEditor.presetSaveHintBound': '保存时会记录当前模型目录项，但应用模板时仍不会替换步骤模型引用。',
    'templateEditor.presetSaveHintKeep': '默认保留当前步骤模型，只覆盖 temperature、max tokens 和 system prompt。',
    'templateEditor.presetSaveHintNoModel': '当前步骤没有模型引用，保存时将默认保留当前模型策略。',
    'templateEditor.savePreset': '保存模板',
    'templateEditor.viewList': '列表',
    'templateEditor.viewBlueprint': '蓝图',
    'templateEditor.blueprintAutoLayout': '自动布局',
    'templateEditor.blueprintConnect': '连线',
    'templateEditor.blueprintZoom': ({ value }) => `缩放 ${value}%`,
    'templateEditor.blueprintConnectFailed': ({ reason }) => `连线失败：${reason}`,
  },
  'en-US': {
    'project.untitled': 'Untitled project',
    'project.template': 'Template',
    'project.id': 'ID',
    'project.compact': 'Compact',
    'project.detail': 'Detail',
    'project.clearLogs': 'Clear logs',
    'project.clearLogsTitle': 'Clear project logs',
    'project.clearLogsMessage': 'Clear all run logs for this project? Step outputs will stay unchanged.',
    'project.liveOutline': 'Live output outline',
    'project.show': 'Show',
    'project.hide': 'Hide',
    'project.doubleClickToCopy': 'Double click to copy',
    'step.manual': 'Manual',
    'step.manualMessage': 'This step has no model ref and is treated as a manual step.',
    'step.missingRef': 'Missing ref',
    'step.missingRefMessage': 'The step expects a model ref, but the ref cannot be found.',
    'step.missingModel': 'Missing model',
    'step.missingModelMessage': 'The model ref is not bound to a model catalog item.',
    'step.modelOff': 'Model off',
    'step.modelOffMessage': 'The bound model catalog item is disabled.',
    'step.missingProvider': 'Missing provider',
    'step.missingProviderMessage': 'The model catalog item points to a provider that no longer exists.',
    'step.providerOff': 'Provider off',
    'step.providerOffMessage': 'The bound provider is disabled.',
    'step.missingKey': 'Missing key',
    'step.missingKeyMessage': 'The bound provider has no API key configured.',
    'step.unsupported': 'Unsupported',
    'step.unsupportedMessage': 'This provider type does not support execution here yet.',
    'step.runnable': 'Runnable',
    'step.runnableMessage': ({ provider, model }) => `Will run with ${provider} / ${model}.`,
    'step.unknown': 'Unknown',
    'step.unknownMessage': 'Execution availability is unknown.',
    'step.synced': 'Synced',
    'step.stale': 'Stale',
    'step.draft': 'Draft',
    'step.empty': 'Empty',
    'step.running': 'Running',
    'step.done': 'Done',
    'step.failed': 'Failed',
    'step.idle': 'Idle',
    'step.missingVars': ({ count }) => `Missing vars ${count}`,
    'step.staleDeps': ({ count }) => `Stale deps ${count}`,
    'step.copy': 'Copy',
    'step.generate': 'Generate',
    'step.model': 'Model',
    'step.provider': 'Provider',
    'step.temperature': 'Temperature',
    'step.maxTokens': 'Max Tokens',
    'step.default': 'Default',
    'step.systemPrompt': 'System Prompt',
    'step.notSet': 'Not set',
    'step.unbound': 'Unbound',
    'step.prompt': 'Prompt',
    'step.outputVar': 'Output var',
    'step.source': 'Source',
    'step.missing': 'Missing',
    'step.staleLabel': 'Stale',
    'step.result': 'Result',
    'step.resultHint': "Supports [[step]] / {{var}}",
    'step.resultPlaceholder': 'Store generated text, notes, or reusable output here...',
    'step.clear': 'Clear',
    'step.runLogs': 'Run logs',
    'step.summaryView': 'Summary view',
    'step.detailView': 'Detail view',
    'step.logCount': ({ count }) => `${count} log(s)`,
    'step.noRunLogs': 'No run logs yet.',
    'step.showHistory': 'Show history',
    'step.hideHistory': 'Hide history',
    'step.clearStepLogs': 'Clear logs',
    'step.clearStepLogsTitle': 'Clear step logs',
    'step.clearStepLogsMessage': 'Clear run logs for this step? The result box will stay unchanged.',
    'step.latestResult': ({ text }) => `Latest result: ${text}`,
    'step.latestError': ({ text }) => `Latest error: ${text}`,
    'step.copySystem': 'Copy System',
    'step.copyUser': 'Copy User',
    'step.copyResult': 'Copy Result',
    'step.copyError': 'Copy Error',
    'step.restoreResult': 'Restore Result',
    'step.userPrompt': 'User Prompt',
    'step.output': 'Output',
    'step.error': 'Error',
    'step.emptyText': 'Empty',
    'step.roleText': 'Text',
    'step.roleManual': 'Manual',
    'step.roleExternal': 'External',
    'step.autoRun': 'Auto',
    'step.autoRunOff': 'Manual',
    'step.roleInfo': ({ role }) => `Step type: ${role}`,
    'step.autoRunInfo': ({ status }) => `Auto run: ${status}`,
    'toast.copied': ({ label }) => `${label} copied`,
    'toast.restored': 'Restored',
    'toast.generated': 'Generated',
    'toast.result': 'Result',
    'toast.systemPrompt': 'System Prompt',
    'toast.userPrompt': 'User Prompt',
    'toast.error': 'Error',
    'editor.edited': 'Edited',
    'editor.syncTemplate': 'Sync template',
    'editor.revert': 'Revert',
    'editor.editing': 'Editing original',
    'editor.waiting': 'Waiting for input or variable interpolation...',
    'editor.saveTitle': 'Save to template',
    'editor.saveMessage': 'Write this local step override back to the template? This affects all projects using the template.',
    'settings.language': 'Language',
    'settings.languageZh': '中文',
    'settings.languageEn': 'English',
    'sidebar.vars': 'Variables',
    'sidebar.nav': 'Steps',
    'sidebar.build': 'Bake',
    'sidebar.importVarTable': 'Import table',
    'sidebar.exportJson': 'Export JSON',
    'sidebar.exportCsv': 'Export CSV',
    'sidebar.inputVars': 'Input vars',
    'sidebar.localVars': 'Local vars',
    'sidebar.resultVars': 'Result vars',
    'sidebar.duplicateVar': 'Cannot copy',
    'sidebar.duplicateVarMessage': 'This variable has no content to copy yet.',
    'sidebar.varNamePlaceholder': 'Name...',
    'sidebar.cancel': 'Cancel',
    'sidebar.add': 'Add',
    'sidebar.addLocalVar': '+ Add local var',
    'sidebar.noResultVars': 'No result variables yet.',
    'sidebar.stepSource': 'Source step',
    'sidebar.sourceType': 'Source type',
    'sidebar.copyVar': 'Copy value',
    'sidebar.goSource': 'Go to source step',
    'sidebar.bakeTitle': 'Bake full prompt',
    'sidebar.bakeDescription': 'Merge all step content and export it as a plain .txt file.',
    'sidebar.startExport': 'Start export',
    'sidebar.openProjectFirst': 'Open a project from the library first',
    'fileLibrary.title': 'Library',
    'fileLibrary.subtitle': 'Local project manager',
    'fileLibrary.restoreAll': 'Restore all',
    'fileLibrary.backupData': 'Backup data',
    'fileLibrary.mergeData': 'Merge data',
    'fileLibrary.assetsTitle': 'Project assets',
    'fileLibrary.visibleProjects': ({ count }) => `${count} visible project(s)`,
    'fileLibrary.batchManage': 'Batch manage',
    'fileLibrary.exitManage': 'Exit manage',
    'fileLibrary.showArchived': 'Show archived',
    'fileLibrary.searchTags': 'Search tags...',
    'fileLibrary.scale': 'Scale',
    'fileLibrary.grouped': 'Grouped',
    'fileLibrary.flat': 'Flat',
    'fileLibrary.sortByModified': 'Modified time',
    'fileLibrary.sortByCreated': 'Created time',
    'fileLibrary.sortByName': 'Name',
    'fileLibrary.noVisibleAssets': 'No visible assets found',
    'fileLibrary.quickCreate': 'Quick create',
    'fileLibrary.newTemplate': 'New template',
    'fileLibrary.batchInstantiate': 'Batch instantiate',
    'fileLibrary.selectTemplate': 'Select template',
    'fileLibrary.batchCreate': 'Batch create',
    'fileLibrary.batchRun': 'Batch run',
    'fileLibrary.useTemplate': 'Use template',
    'fileLibrary.editTemplate': 'Edit',
    'fileLibrary.selected': 'Selected',
    'fileLibrary.selectAll': 'Select all',
    'fileLibrary.clearAll': 'Clear all',
    'fileLibrary.batchDelete': 'Batch delete',
    'fileLibrary.ungroupedProjects': 'Ungrouped projects',
    'fileLibrary.importFailed': 'Failed',
    'fileLibrary.importEmpty': 'The selected file is empty.',
    'fileLibrary.importInvalidJson': 'The file content is not valid JSON.',
    'fileLibrary.importInvalidBundle': ({ error }) => `Bundle validation failed: ${error}`,
    'fileLibrary.importReadFailed': 'Failed to read or parse the JSON file.',
    'fileLibrary.missingTemplate': 'Missing',
    'fileLibrary.created': 'Created',
    'fileLibrary.modified': 'Modified',
    'fileLibrary.unarchive': 'Unarchive',
    'fileLibrary.archive': 'Archive project',
    'fileLibrary.extractTemplate': 'Extract template',
    'fileLibrary.deleteForever': 'Delete permanently',
    'fileLibrary.projectCount': ({ count }) => `${count} project(s)`,
    'fileLibrary.noVisibleAssetsHint': 'No projects match the current filter. Check whether the eye icon on the template card is hiding them.',
    'fileLibrary.showTemplateAssets': 'Show assets for this template',
    'fileLibrary.hideTemplateAssets': 'Hide assets for this template',
    'fileLibrary.duplicateTemplate': 'Duplicate template',
    'fileLibrary.deleteTemplate': 'Delete template',
    'fileLibrary.cancel': 'Cancel',
    'templateEditor.title': 'Edit template',
    'templateEditor.cancel': 'Cancel',
    'templateEditor.save': 'Save template',
    'templateEditor.name': 'Template name',
    'templateEditor.tags': 'Tags',
    'templateEditor.addTag': 'Add tag...',
    'templateEditor.inputSection': '1. Input variables',
    'templateEditor.modelRefSection': '2. Model refs',
    'templateEditor.stepsSection': '3. Workflow steps',
    'templateEditor.add': '+ Add',
    'templateEditor.inputHelp': 'You can still use <index>, <label>, or {{variable_key}} to reference context in the template.',
    'templateEditor.inputName': 'Variable name',
    'templateEditor.modelRefHelp': 'Define reusable model refs here. Steps choose a ref instead of configuring a provider or API directly.',
    'templateEditor.noModelRef': 'No model refs yet. Steps without a model ref stay manual by default.',
    'templateEditor.modelRefName': 'Model ref name',
    'templateEditor.unboundModel': 'Do not bind a model',
    'templateEditor.missingModelItem': 'The bound model catalog item no longer exists.',
    'templateEditor.disabledModelItem': 'The bound model catalog item is disabled.',
    'templateEditor.selectAllSteps': 'Select all steps',
    'templateEditor.selectByModelRef': 'Select by model ref',
    'templateEditor.selectSameModelRef': 'Select same-ref steps',
    'templateEditor.selectedSteps': ({ count }) => `${count} step(s) selected`,
    'templateEditor.applyCopiedConfig': 'Apply copied config',
    'templateEditor.clearSelection': 'Clear selection',
    'templateEditor.stepName': 'Step name',
    'templateEditor.description': 'Description',
    'templateEditor.optionalDescription': 'Optional description',
    'templateEditor.promptContent': 'Prompt template content',
    'templateEditor.promptPlaceholder': 'Write the prompt, for example: generate content from {{topic}}...',
    'templateEditor.modelRef': 'Model ref',
    'templateEditor.manualStepHint': 'Only choose model refs defined in the template here. Leaving it empty keeps the step manual.',
    'templateEditor.currentPreset': 'Current preset',
    'templateEditor.executionPreset': 'DeepSeek presets',
    'templateEditor.clearPreset': 'Reset to default',
    'templateEditor.presetHelp': 'Presets fill Temperature and Max Tokens below. You can still fine-tune them afterwards.',
    'templateEditor.noModelRefOption': 'No model ref',
    'templateEditor.disabledSuffix': ' [disabled]',
    'templateEditor.missingSuffix': ' [missing]',
    'templateEditor.recommendedPreset': 'Recommended preset',
    'templateEditor.recommendedPresetAuto': ', auto-applied on first binding.',
    'templateEditor.recommendedPresetManual': ', current params were set manually and will not be overwritten.',
    'templateEditor.executionStatus': 'Execution status',
    'templateEditor.statusNote': 'Status note',
    'templateEditor.defaultPlaceholder': 'Leave empty to use default',
    'templateEditor.currentTemplate': 'Current template',
    'templateEditor.recommendedTemplate': 'Recommended template',
    'templateEditor.systemPromptAuto': ', auto-applied on first binding.',
    'templateEditor.systemPromptManual': ', current content was set manually and will not be overwritten.',
    'templateEditor.clearTemplate': 'Clear template',
    'templateEditor.systemPromptPlaceholder': 'For example: reshape a Chinese requirement into a prompt suited for this model.',
    'templateEditor.outputToVar': 'Output to variable',
    'templateEditor.bindingHelp': 'Leaving the variable key empty means no binding. Once configured, this step can write its result into that variable.',
    'templateEditor.varKey': 'Variable key',
    'templateEditor.displayName': 'Display name',
    'templateEditor.bindingKnown': 'This key already exists in the template context.',
    'templateEditor.bindingNew': 'This key does not exist yet and will create a new output variable.',
    'templateEditor.addStep': 'Add new step',
    'templateEditor.defaultModelRefLabel': ({ count }) => `Model ref ${count}`,
    'templateEditor.deleteInputTitle': 'Delete input variable',
    'templateEditor.deleteInputMessage': 'Delete this input variable? Steps that depend on it may need manual placeholder updates.',
    'templateEditor.deleteModelRefTitle': 'Delete model ref',
    'templateEditor.deleteModelRefMessage': 'Delete this model ref? Steps using it will fall back to manual mode.',
    'templateEditor.deleteStepTitle': 'Delete step',
    'templateEditor.deleteStepMessage': 'Delete this step?',
    'templateEditor.untitledStep': 'Untitled step',
    'templateEditor.selectStep': 'Select step',
    'templateEditor.unselectStep': 'Unselect step',
    'templateEditor.copiedExecutionConfig': 'Execution config copied',
    'templateEditor.moveUp': 'Move up',
    'templateEditor.moveDown': 'Move down',
    'templateEditor.deleteStep': 'Delete step',
    'templateEditor.delete': 'Delete',
    'templateEditor.copyExecutionConfig': 'Copy execution config',
    'templateEditor.applyCopiedConfigFrom': ({ stepName }) => `Apply copied execution config from ${stepName}`,
    'templateEditor.moreActions': 'More',
    'templateEditor.executionSummary': 'Execution',
    'templateEditor.expandExecution': 'Expand execution',
    'templateEditor.collapseExecution': 'Collapse execution',
    'templateEditor.bindingSummaryUnbound': 'No output variable bound',
    'templateEditor.bindingSummaryBound': ({ key }) => `Output syncs to {{${key}}}`,
    'templateEditor.expandBinding': 'Expand variable config',
    'templateEditor.collapseBinding': 'Collapse variable config',
    'templateEditor.executionTemplateSelect': 'Select execution template',
    'templateEditor.applyExecutionTemplate': 'Apply execution template',
    'templateEditor.saveAsPreset': 'Save current config as template',
    'templateEditor.stepType': 'Step type',
    'templateEditor.stepTypeText': 'Text generation',
    'templateEditor.stepTypeManual': 'Manual confirmation',
    'templateEditor.stepTypeExternal': 'External execution',
    'templateEditor.stepTypeHelpText': 'Suitable for later batch execution with language models.',
    'templateEditor.stepTypeHelpManual': 'The automatic flow must stop here for user review or edits.',
    'templateEditor.stepTypeHelpExternal': 'Currently only prepares the prompt; it does not call image or video models.',
    'templateEditor.autoRunEnabled': 'Allow automatic execution',
    'templateEditor.autoRunHelp': 'Only text-generation steps can join later semi-automatic runs.',
    'templateEditor.autoRunDisabledHelp': 'Only text-generation steps can enable automatic execution.',
    'templateEditor.presetName': 'Preset name',
    'templateEditor.presetDescription': 'Description',
    'templateEditor.modelStrategy': 'Model strategy',
    'templateEditor.keepCurrentModel': 'Keep current model',
    'templateEditor.bindCurrentCatalogModel': 'Bind current catalog model',
    'templateEditor.presetSaveHintBound': 'The current catalog model will be recorded, but applying the preset still keeps the step model ref.',
    'templateEditor.presetSaveHintKeep': 'The current step model stays unchanged; only temperature, max tokens, and system prompt are applied.',
    'templateEditor.presetSaveHintNoModel': 'This step has no model ref, so the preset will default to keep current model.',
    'templateEditor.savePreset': 'Save preset',
    'templateEditor.viewList': 'List',
    'templateEditor.viewBlueprint': 'Blueprint',
    'templateEditor.blueprintAutoLayout': 'Auto layout',
    'templateEditor.blueprintConnect': 'Connect',
    'templateEditor.blueprintZoom': ({ value }) => `Zoom ${value}%`,
    'templateEditor.blueprintConnectFailed': ({ reason }) => `Connection failed: ${reason}`,
  },
};

Object.assign(messages['zh-CN'], {
  'project.untitled': '未命名项目',
  'project.template': '模板',
  'project.id': 'ID',
  'project.compact': '紧凑',
  'project.detail': '详细',
  'project.clearLogs': '清空日志',
  'project.clearLogsTitle': '清空项目日志',
  'project.clearLogsMessage': '清空这个项目的全部运行日志吗？步骤结果会保留。',
  'project.updateProducers': '更新生产节点',
  'project.producerPreflightTitle': '更新生产节点',
  'project.producerPreflightSubtitle':
    '先检查当前项目中的生产节点，再决定哪些已有结果需要覆盖。',
  'project.producerReady': '可执行',
  'project.producerBlocked': '被阻塞',
  'project.producerExisting': '已有结果',
  'project.producerOverwriteAll': '全部覆盖',
  'project.producerSkipAll': '全部跳过',
  'project.producerStart': '开始更新',
  'project.producerNothingToRun': '当前没有可执行的生产节点。',
  'project.producerResultTitle': '生产节点更新结果',
  'project.producerStop': '停止',
  'project.producerStopping': '停止中…',
  'project.producerCurrent': '当前节点',
  'project.producerProgress': '执行进度',
  'project.producerSkipped': '已跳过',
  'project.producerStopped': '已停止',
  'project.producerWillOverwrite': '将覆盖现有结果',
  'project.producerOutputVar': '输出变量',
  'project.producerBlockedReason': '阻塞原因',
  'project.producerNoReady': '本次没有节点会进入执行。',
  'project.producerSummary': '汇总',
  'project.producerScope': '执行范围',
  'project.producerScopeEmpty': '仅更新空结果',
  'project.producerScopeChanged': '仅更新已变化节点',
  'project.producerScopeAll': '全量更新生产节点',
  'step.autoQueued': '队列中',
  'step.autoBlocked': '已阻塞',
  'step.autoSkipped': '已跳过',
  'step.autoStopped': '已停止',
  'step.autoStateInfo': ({ state }) => `自动化状态: ${state}`,
  'step.structuredParsing': '结构化解析中',
  'step.structuredAwaitingConfirm': '等待覆盖确认',
  'step.structuredUpdated': '已更新结构化结果',
  'step.structuredSkipped': '已跳过结构化解析',
  'step.structuredFailed': '结构化解析失败',
  'step.structuredOverwriteTitle': '覆盖结构化结果',
  'step.structuredOverwriteTitleAutomation': '自动流程检测到已有结果',
  'step.structuredOverwriteMessage': '检测到该步骤已有结构化结果，是否覆盖并重新解析？',
  'step.structuredOverwriteMessageAutomation': '自动执行时检测到该步骤已有结构化结果，是否覆盖并继续解析？',
  'step.structuredSkipParse': '跳过解析',
  'step.structuredOverwriteAndParse': '覆盖并解析',
});

Object.assign(messages['en-US'], {
  'project.updateProducers': 'Update producers',
  'project.producerPreflightTitle': 'Update producer nodes',
  'project.producerPreflightSubtitle':
    'Check producer nodes in the current project first, then choose which existing results should be overwritten.',
  'project.producerReady': 'Ready',
  'project.producerBlocked': 'Blocked',
  'project.producerExisting': 'Existing result',
  'project.producerOverwriteAll': 'Overwrite all',
  'project.producerSkipAll': 'Skip all',
  'project.producerStart': 'Start update',
  'project.producerNothingToRun': 'There are no runnable producer nodes in the current project.',
  'project.producerResultTitle': 'Producer update results',
  'project.producerStop': 'Stop',
  'project.producerStopping': 'Stopping…',
  'project.producerCurrent': 'Current node',
  'project.producerProgress': 'Progress',
  'project.producerSkipped': 'Skipped',
  'project.producerStopped': 'Stopped',
  'project.producerWillOverwrite': 'Will overwrite the existing result',
  'project.producerOutputVar': 'Output variable',
  'project.producerBlockedReason': 'Blocked reason',
  'project.producerNoReady': 'No node will enter this run.',
  'project.producerSummary': 'Summary',
  'project.producerScope': 'Run scope',
  'project.producerScopeEmpty': 'Empty results only',
  'project.producerScopeChanged': 'Changed nodes only',
  'project.producerScopeAll': 'All producer nodes',
  'step.autoQueued': 'Queued',
  'step.autoBlocked': 'Blocked',
  'step.autoSkipped': 'Skipped',
  'step.autoStopped': 'Stopped',
  'step.autoStateInfo': ({ state }) => `Automation: ${state}`,
  'step.structuredParsing': 'Parsing structured output',
  'step.structuredAwaitingConfirm': 'Waiting for overwrite confirmation',
  'step.structuredUpdated': 'Structured output updated',
  'step.structuredSkipped': 'Structured parsing skipped',
  'step.structuredFailed': 'Structured parsing failed',
  'step.structuredOverwriteTitle': 'Overwrite structured output',
  'step.structuredOverwriteTitleAutomation': 'Existing result detected in automation',
  'step.structuredOverwriteMessage': 'Structured output already exists for this step. Overwrite and parse again?',
  'step.structuredOverwriteMessageAutomation':
    'Automation detected existing structured output for this step. Overwrite and continue parsing?',
  'step.structuredSkipParse': 'Skip parse',
  'step.structuredOverwriteAndParse': 'Overwrite and parse',
});

export const t = (
  language: UiLanguage,
  key: TranslationKey,
  params: Record<string, string | number> = {}
) => {
  const entry = messages[language]?.[key] ?? messages['en-US'][key];
  if (typeof entry === 'function') {
    return entry(params);
  }
  return entry ?? key;
};

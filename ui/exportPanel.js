import * as Blockly from 'blockly';
import { translate } from '../main/translation.js';
import { serializeProject } from '../main/files.js';
import {
  downloadStandaloneHtml,
  downloadStandaloneZip,
  embedCode,
  EMBED_APP_BASE,
  hostedEmbedCode,
} from '../main/standaloneExport.js';

function exportOptions(workspace) {
  const project = serializeProject(workspace);
  const used = new Set(Blockly.Variables.allUsedVarModels(workspace).map((model) => model.getId()));
  if (project.variables) project.variables = project.variables.filter((v) => used.has(v.id));
  return {
    project,
    name: document.getElementById('projectName')?.value.trim() || 'Flock XR project',
    lang: document.documentElement.lang || 'en',
  };
}

async function copyText(textarea) {
  try {
    await navigator.clipboard.writeText(textarea.value);
    return true;
  } catch {
    textarea.select();
    return document.execCommand('copy');
  }
}

function wireCopyButton(textarea, buttonId, statusId) {
  const status = document.getElementById(statusId);
  textarea.addEventListener('focus', () => textarea.select());
  document.getElementById(buttonId).addEventListener('click', async () => {
    const copied = await copyText(textarea);
    status.textContent = translate(copied ? 'export_embed_copied' : 'export_embed_copy_failed');
  });
}

export function initExportPanel(workspace) {
  const downloadButton = document.getElementById('exportWebPageButton');
  const zipButton = document.getElementById('exportWebZipButton');
  const codeArea = document.getElementById('exportEmbedCode');
  const hostedCodeArea = document.getElementById('exportHostedCode');
  if (!downloadButton || !codeArea || !hostedCodeArea) return;

  document.addEventListener('toolstabselect', (e) => {
    if (e.detail.tab !== 'toolsExportTab') return;
    document.getElementById('exportEmbedStatus').textContent = '';
    document.getElementById('exportHostedStatus').textContent = '';
    codeArea.value = embedCode(exportOptions(workspace));
    hostedCodeArea.value = hostedEmbedCode({
      projectUrl: new URL('examples/starter.flock', EMBED_APP_BASE).href,
      comment: translate('export_hosted_comment'),
    });
  });

  downloadButton.addEventListener('click', async () => {
    try {
      await downloadStandaloneHtml(exportOptions(workspace), {
        fileDescription: translate('export_web_page_file_description'),
      });
    } catch (error) {
      console.error('Error exporting web page:', error);
    }
  });

  zipButton?.addEventListener('click', async () => {
    try {
      await downloadStandaloneZip(exportOptions(workspace), {
        fileDescription: translate('export_web_zip_file_description'),
      });
    } catch (error) {
      console.error('Error exporting web zip:', error);
    }
  });

  wireCopyButton(codeArea, 'exportEmbedCopyButton', 'exportEmbedStatus');
  wireCopyButton(hostedCodeArea, 'exportHostedCopyButton', 'exportHostedStatus');
}

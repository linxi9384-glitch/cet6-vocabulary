import { examFile } from './exams.mjs';

let openedPdf;

function storedPdf(data) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('cet6-exam-files', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('scans');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction('scans', data ? 'readwrite' : 'readonly');
      const store = transaction.objectStore('scans');
      const request = data ? store.put(data, 'workbook') : store.get('workbook');
      transaction.oncomplete = () => {
        db.close();
        resolve(request.result);
      };
      transaction.onabort = () => {
        db.close();
        reject(transaction.error);
      };
    };
  });
}

function openPdf(data) {
  openedPdf = (async () => {
    const pdfjs = await import('./vendor/pdfjs/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
    const pdf = await pdfjs.getDocument({ data, useWasm: false, isEvalSupported: false }).promise;
    if (pdf.numPages !== examFile.pages) throw new Error('试卷页数不匹配。');
    return pdf;
  })();
  openedPdf.catch(() => { openedPdf = null; });
  return openedPdf;
}

export async function restoreExamPdf() {
  if (openedPdf) return openedPdf;
  const data = await storedPdf();
  if (!(data instanceof ArrayBuffer) || data.byteLength !== examFile.bytes) return null;
  return openedPdf ?? openPdf(data);
}

export async function importExamPdf(file) {
  const mismatch = '请选择《集训刷题卷(历年真题).pdf》原文件。';
  if (file.size !== examFile.bytes) throw new Error(mismatch);
  const data = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', data);
  const actual = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  if (actual !== examFile.sha256) throw new Error(mismatch);
  // Store bytes before PDF.js transfers the buffer to its worker.
  const saved = await storedPdf(data).then(() => true, () => false);
  const pdf = await (openedPdf ?? openPdf(data));
  return { pdf, saved };
}

let openedPdf;

function storedPdf(key, data) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('cet6-exam-files', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('scans');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction('scans', data ? 'readwrite' : 'readonly');
      const store = transaction.objectStore('scans');
      const request = data ? store.put(data, key) : store.get(key);
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

function openPdf(data, source) {
  const promise = (async () => {
    const pdfjs = await import('./vendor/pdfjs/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
    const pdf = await pdfjs.getDocument({ data, useWasm: false, isEvalSupported: false }).promise;
    if (pdf.numPages !== source.pages) throw new Error('试卷页数不匹配。');
    return pdf;
  })();
  openedPdf = { sha256: source.sha256, promise };
  promise.catch(() => { if (openedPdf?.promise === promise) openedPdf = null; });
  return promise;
}

export async function restoreExamPdf(source, key) {
  if (openedPdf?.sha256 === source.sha256) return openedPdf.promise;
  const data = await storedPdf(key);
  if (!(data instanceof ArrayBuffer) || data.byteLength !== source.bytes) return null;
  return openedPdf?.sha256 === source.sha256 ? openedPdf.promise : openPdf(data, source);
}

export async function importExamPdf(file, source, key) {
  const mismatch = `请选择《${source.name}》原文件。`;
  if (file.size !== source.bytes) throw new Error(mismatch);
  const data = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', data);
  const actual = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  if (actual !== source.sha256) throw new Error(mismatch);
  // Store bytes before PDF.js transfers the buffer to its worker.
  const saved = await storedPdf(key, data).then(() => true, () => false);
  const pdf = await (openedPdf?.sha256 === source.sha256 ? openedPdf.promise : openPdf(data, source));
  return { pdf, saved };
}

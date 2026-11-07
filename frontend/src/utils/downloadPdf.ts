import { apiClient } from '../api/client';
import { addToast } from '../components/ToastContainer';

// window.open(apiUrl) can't carry the app's auth — the JWT lives in
// localStorage and is only attached by apiClient's axios interceptor, so a
// raw browser navigation to an authenticated API route always 401s. Fetch
// the PDF through apiClient instead (which does attach the token) and save
// the bytes as a real download.
export async function downloadReportPdf(path: string, filename: string): Promise<void> {
  try {
    const res = await apiClient.get(path, { responseType: 'blob' });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    addToast({ id: Date.now().toString(), type: 'error', title: 'Export Failed', body: 'Could not generate the PDF. Please try again.', read: false, created_at: new Date().toISOString() });
  }
}

import { useCallback, useEffect, useState } from 'react';
import { Button, PageHeader, SectionCard } from '../components/ui';
import { supabase, supabaseUrl } from '../lib/supabase';

type ArchiveFile = {
  path: string;
  name: string;
  size: number;
  updatedAt: string | null;
};

const formatSize = (bytes: number): string => {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

const formatWhen = (iso: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** The API checks the owner role and signs the file, so storage stays private. */
async function apiGet<T>(path: string): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in again to open chat archives.');

  const response = await fetch(`${supabaseUrl}/functions/v1/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string } })
    | null;
  if (!response.ok || !payload) {
    throw new Error(payload?.error?.message ?? 'The archive request failed.');
  }
  return payload;
}

export function ChatArchivePage({ notify }: { notify: (message: string) => void }) {
  const [files, setFiles] = useState<ArchiveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { files: next } = await apiGet<{ files: ArchiveFile[] }>('/chat-archives');
      setFiles(next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load chat archives.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const download = async (file: ArchiveFile) => {
    setDownloading(file.path);
    try {
      const { url } = await apiGet<{ url: string }>(
        `/chat-archives/download?path=${encodeURIComponent(file.path)}`,
      );
      window.open(url, '_blank', 'noopener,noreferrer');
      notify(`Downloading ${file.name}.`);
    } catch (downloadError) {
      notify(
        downloadError instanceof Error ? downloadError.message : 'Could not download that archive.',
      );
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Workspace"
        title="Chat Archive"
        subtitle="Finished jobs keep their conversation as a JSONL backup. Owner access only."
        actions={
          <Button icon="refresh" disabled={loading} onClick={() => void refresh()}>
            Refresh
          </Button>
        }
      />

      <SectionCard
        title="Archived conversations"
        meta={`${files.length} backup${files.length === 1 ? '' : 's'} · one line per message`}
      >
        {error ? (
          <p className="cell-sub" role="alert">
            {error}
          </p>
        ) : loading ? (
          <p className="cell-sub">Loading archives…</p>
        ) : files.length === 0 ? (
          <p className="cell-sub">
            No chats have been archived yet. A conversation is exported when its job is completed.
          </p>
        ) : (
          <div className="table-scroll" role="region" aria-label="Chat archives" tabIndex={0}>
            <table className="table">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Archived</th>
                  <th>Size</th>
                  <th aria-label="Download" />
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.path}>
                    <td>
                      <strong>{file.name.replace(/\.jsonl$/, '')}</strong>
                      <small className="cell-sub">JSONL</small>
                    </td>
                    <td>{formatWhen(file.updatedAt)}</td>
                    <td>{formatSize(file.size)}</td>
                    <td>
                      <Button
                        icon="download"
                        disabled={downloading === file.path}
                        onClick={() => void download(file)}
                      >
                        Download
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

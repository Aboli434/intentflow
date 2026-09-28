'use client';

import React, { useState } from 'react';
import { apiUploadAttachment, apiDeleteAttachment, getAttachmentDownloadUrl } from '../../lib/api-client';

import { useToast } from './ToastContext';
import { ConfirmModal } from './ConfirmModal';

export interface AttachmentItem {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploaderName?: string;
  createdAt?: string;
}

export interface AttachmentListProps {
  projectId: string;
  attachments?: AttachmentItem[];
  canUpload?: boolean;
  canDelete?: boolean;
  relatedEntityType?: string;
  relatedEntityId?: string;
  onUploadSuccess?: (newAttachment: AttachmentItem) => void;
  onDeleteSuccess?: (attachmentId: string) => void;
}

export function AttachmentList({
  projectId,
  attachments = [],
  canUpload = true,
  canDelete = true,
  relatedEntityType,
  relatedEntityId,
  onUploadSuccess,
  onDeleteSuccess,
}: AttachmentListProps) {
  const { showToast } = useToast();
  const [uploading, setUploading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string, fileName: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) return '📦';
    if (mimeType.includes('json') || mimeType.includes('javascript') || fileName.endsWith('.ts') || fileName.endsWith('.json')) return '⚡';
    return '📎';
  };

  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setErrorMsg(null);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 25 * 1024 * 1024) {
        const msg = `"${file.name}" exceeds the 25MB file size limit.`;
        setErrorMsg(msg);
        showToast('File size limit exceeded', { type: 'error', message: msg });
        setUploading(false);
        return;
      }
      try {
        const uploaded = await apiUploadAttachment(
          file,
          projectId,
          undefined,
          relatedEntityType,
          relatedEntityId
        );
        onUploadSuccess?.(uploaded);
        showToast('Attachment uploaded', { type: 'success', message: file.name });
      } catch (err: any) {
        const msg = err.message || `Failed to upload "${file.name}"`;
        setErrorMsg(msg);
        showToast('Upload failed', { type: 'error', message: msg });
      }
    }
    setUploading(false);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await apiDeleteAttachment(deletingId);
      onDeleteSuccess?.(deletingId);
      showToast('Attachment removed', { type: 'success' });
    } catch (err: any) {
      showToast('Delete failed', { type: 'error', message: err.message });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* File Upload Dropzone */}
      {canUpload && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files) handleUploadFiles(e.dataTransfer.files);
          }}
          className={`relative border-2 border-dashed rounded-xl p-4 text-center transition-all ${
            dragOver
              ? 'border-indigo-500 bg-indigo-500/10'
              : 'border-[#1F2937] hover:border-indigo-500/50 bg-[#0B0F19]'
          }`}
        >
          <input
            type="file"
            id={`file-upload-input-${projectId}-${relatedEntityId || 'gen'}`}
            className="hidden"
            multiple
            onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
          />
          <label
            htmlFor={`file-upload-input-${projectId}-${relatedEntityId || 'gen'}`}
            className="cursor-pointer flex flex-col items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg p-1"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-base">
              📤
            </div>
            <span className="text-xs font-semibold text-slate-200">
              {uploading ? 'Uploading attachment...' : 'Click or drag files here to attach'}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Max 25MB per file • Documents, images, archives</span>
          </label>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold p-2.5 rounded-xl flex justify-between items-center">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-xs underline text-rose-300">Dismiss</button>
        </div>
      )}

      {/* Attachment List Cards */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center justify-between p-3 rounded-xl bg-[#111827] border border-[#1F2937] hover:border-slate-700 transition-all text-xs"
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <span className="text-base select-none">{getFileIcon(att.mimeType, att.fileName)}</span>
                <div className="min-w-0">
                  <p className="font-bold text-slate-200 truncate">{att.fileName}</p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {formatSize(att.size)} {att.uploaderName ? `• Uploaded by ${att.uploaderName}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={getAttachmentDownloadUrl(att.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-[#151D2E] hover:bg-[#1F2937] text-indigo-300 border border-indigo-500/30 font-semibold text-[11px] transition-all flex items-center gap-1"
                >
                  <span>⬇</span> Download
                </a>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setDeletingId(att.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                    title="Delete attachment"
                    aria-label="Delete attachment"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={confirmDelete}
        title="Delete Attachment"
        description="Are you sure you want to delete this attachment? This action cannot be undone."
        confirmText="Delete Attachment"
        variant="danger"
      />
    </div>
  );
}

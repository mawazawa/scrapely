<script setup lang="ts">
/**
 * Document Viewer Component
 * Displays court documents with PDF viewer and OCR text
 */

import { ref, computed, watch, onMounted } from 'vue';

interface DocumentVersion {
  version: number;
  key: string;
  uploadedAt: string;
  sizeBytes: number;
  sizeFormatted: string;
  checksum: string;
}

interface DocumentDetails {
  documentId: string;
  currentVersion: number;
  versions: DocumentVersion[];
  createdAt: string;
  lastModifiedAt: string;
  hasOcr: boolean;
  ocrPreview?: string;
}

const props = defineProps<{
  courtId: string;
  caseNumber: string;
  documentId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'download', url: string): void;
}>();

// State
const loading = ref(true);
const error = ref<string | null>(null);
const document = ref<DocumentDetails | null>(null);
const selectedVersion = ref<number>(1);
const showOcr = ref(false);
const ocrText = ref<string | null>(null);
const loadingOcr = ref(false);
const downloadUrl = ref<string | null>(null);

// Computed
const currentVersionData = computed(() => {
  if (!document.value) return null;
  return document.value.versions.find(v => v.version === selectedVersion.value);
});

const formattedDate = computed(() => {
  if (!document.value) return '';
  return new Date(document.value.lastModifiedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
});

// Methods
async function fetchDocument() {
  loading.value = true;
  error.value = null;

  try {
    const response = await fetch(
      `/api/court/documents/${props.courtId}/${props.caseNumber}/${props.documentId}`
    );

    if (!response.ok) {
      throw new Error('Failed to load document');
    }

    const data = await response.json();
    document.value = data;
    selectedVersion.value = data.currentVersion;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    loading.value = false;
  }
}

async function fetchDownloadUrl() {
  try {
    const response = await fetch(
      `/api/court/documents/${props.courtId}/${props.caseNumber}/${props.documentId}/download?version=${selectedVersion.value}`
    );

    if (!response.ok) {
      throw new Error('Failed to get download URL');
    }

    const data = await response.json();
    downloadUrl.value = data.downloadUrl;
  } catch (err) {
    console.error('Failed to get download URL:', err);
  }
}

async function fetchOcrText() {
  if (ocrText.value) return;  // Already loaded

  loadingOcr.value = true;

  try {
    const response = await fetch(
      `/api/court/documents/${props.courtId}/${props.caseNumber}/${props.documentId}/ocr?version=${selectedVersion.value}`
    );

    if (!response.ok) {
      throw new Error('OCR not available');
    }

    const data = await response.json();
    ocrText.value = data.text;
  } catch (err) {
    ocrText.value = 'OCR text not available for this document.';
  } finally {
    loadingOcr.value = false;
  }
}

function handleDownload() {
  if (downloadUrl.value) {
    emit('download', downloadUrl.value);
    window.open(downloadUrl.value, '_blank');
  }
}

function toggleOcr() {
  showOcr.value = !showOcr.value;
  if (showOcr.value && !ocrText.value) {
    fetchOcrText();
  }
}

// Watch for version changes
watch(selectedVersion, () => {
  fetchDownloadUrl();
  ocrText.value = null;  // Reset OCR for new version
});

// Initialize
onMounted(() => {
  fetchDocument();
  fetchDownloadUrl();
});
</script>

<template>
  <div class="document-viewer">
    <!-- Header -->
    <div class="viewer-header">
      <div class="header-left">
        <h2 class="document-title">{{ documentId }}</h2>
        <p class="document-meta" v-if="document">
          Last modified: {{ formattedDate }}
        </p>
      </div>
      <div class="header-right">
        <button @click="emit('close')" class="btn-close">
          <span class="sr-only">Close</span>
          &times;
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading document...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <p class="error-message">{{ error }}</p>
      <button @click="fetchDocument" class="btn-retry">
        Try Again
      </button>
    </div>

    <!-- Document Content -->
    <div v-else-if="document" class="document-content">
      <!-- Toolbar -->
      <div class="toolbar">
        <div class="toolbar-left">
          <!-- Version Selector -->
          <div class="version-selector" v-if="document.versions.length > 1">
            <label for="version-select">Version:</label>
            <select
              id="version-select"
              v-model="selectedVersion"
            >
              <option
                v-for="v in document.versions"
                :key="v.version"
                :value="v.version"
              >
                v{{ v.version }} - {{ new Date(v.uploadedAt).toLocaleDateString() }}
                ({{ v.sizeFormatted }})
              </option>
            </select>
          </div>
        </div>

        <div class="toolbar-right">
          <!-- OCR Toggle -->
          <button
            v-if="document.hasOcr"
            @click="toggleOcr"
            class="btn-toolbar"
            :class="{ active: showOcr }"
          >
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {{ showOcr ? 'Hide Text' : 'Show Text' }}
          </button>

          <!-- Download Button -->
          <button
            @click="handleDownload"
            class="btn-download"
            :disabled="!downloadUrl"
          >
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Download
          </button>
        </div>
      </div>

      <!-- Main Viewer Area -->
      <div class="viewer-main" :class="{ 'with-sidebar': showOcr }">
        <!-- PDF Viewer -->
        <div class="pdf-viewer">
          <iframe
            v-if="downloadUrl"
            :src="downloadUrl"
            class="pdf-frame"
            title="Document Preview"
          ></iframe>
          <div v-else class="pdf-placeholder">
            <p>Document preview unavailable</p>
            <button @click="fetchDownloadUrl" class="btn-retry">
              Load Preview
            </button>
          </div>
        </div>

        <!-- OCR Sidebar -->
        <div v-if="showOcr" class="ocr-sidebar">
          <div class="ocr-header">
            <h3>Extracted Text</h3>
          </div>
          <div class="ocr-content">
            <div v-if="loadingOcr" class="loading-state">
              <div class="spinner small"></div>
              <p>Loading text...</p>
            </div>
            <pre v-else class="ocr-text">{{ ocrText }}</pre>
          </div>
        </div>
      </div>

      <!-- Version History -->
      <div class="version-history" v-if="document.versions.length > 1">
        <h3>Version History</h3>
        <ul class="version-list">
          <li
            v-for="v in document.versions"
            :key="v.version"
            :class="{ current: v.version === selectedVersion }"
          >
            <button @click="selectedVersion = v.version" class="version-item">
              <span class="version-number">v{{ v.version }}</span>
              <span class="version-date">
                {{ new Date(v.uploadedAt).toLocaleDateString() }}
              </span>
              <span class="version-size">{{ v.sizeFormatted }}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.document-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.document-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.document-meta {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0.25rem 0 0;
}

.btn-close {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: #6b7280;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-close:hover {
  background: #f3f4f6;
  color: #111827;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
}

.spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner.small {
  width: 1.5rem;
  height: 1.5rem;
  border-width: 2px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-message {
  color: #dc2626;
  margin-bottom: 1rem;
}

.btn-retry {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-retry:hover {
  background: #2563eb;
}

.document-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.version-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.version-selector label {
  font-size: 0.875rem;
  color: #6b7280;
}

.version-selector select {
  padding: 0.375rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
}

.btn-toolbar {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #374151;
  cursor: pointer;
}

.btn-toolbar:hover {
  background: #f3f4f6;
}

.btn-toolbar.active {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #3b82f6;
}

.btn-download {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  background: #3b82f6;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  color: white;
  cursor: pointer;
}

.btn-download:hover {
  background: #2563eb;
}

.btn-download:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.icon {
  width: 1rem;
  height: 1rem;
}

.viewer-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.viewer-main.with-sidebar .pdf-viewer {
  flex: 2;
}

.pdf-viewer {
  flex: 1;
  display: flex;
  background: #1f2937;
}

.pdf-frame {
  width: 100%;
  height: 100%;
  border: none;
}

.pdf-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  color: #9ca3af;
}

.ocr-sidebar {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #e5e7eb;
  background: #fafafa;
  max-width: 400px;
}

.ocr-header {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.ocr-header h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.ocr-content {
  flex: 1;
  overflow: auto;
  padding: 1rem;
}

.ocr-text {
  font-family: ui-monospace, monospace;
  font-size: 0.75rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  color: #374151;
}

.version-history {
  padding: 1rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.version-history h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.75rem;
}

.version-list {
  display: flex;
  gap: 0.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-x: auto;
}

.version-list li.current .version-item {
  background: #eff6ff;
  border-color: #3b82f6;
}

.version-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0.5rem 0.75rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  cursor: pointer;
  min-width: 100px;
}

.version-item:hover {
  background: #f3f4f6;
}

.version-number {
  font-weight: 600;
  color: #111827;
}

.version-date {
  font-size: 0.75rem;
  color: #6b7280;
}

.version-size {
  font-size: 0.75rem;
  color: #9ca3af;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>

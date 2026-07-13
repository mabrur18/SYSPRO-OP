import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import fs from 'fs';
import puppeteer from 'puppeteer';

export const runtime = 'nodejs';

type ItemWithPhotos = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  required_photo_count: number;
  photos: Array<{
    id: string;
    caption: string | null;
    status: string;
    thumbnail_url: string | null;
    drive_file_url: string;
    uploaded_at: string;
  }>;
};

function escapeHtml(value: string | null | undefined) {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function resolveBrowserExecutablePath() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function buildReportHtml(project: Record<string, any>, items: ItemWithPhotos[]) {
  const totalPhotos = items.reduce((sum, item) => sum + (item.photos?.length ?? 0), 0);
  const itemSections = items.map((item, index) => {
    const photos = item.photos ?? [];
    const photoCards = photos.length
      ? photos
          .map((photo) => {
            const imageUrl = photo.thumbnail_url || photo.drive_file_url;
            const caption = escapeHtml(photo.caption || 'Foto tanpa caption');
            const status = escapeHtml(photo.status);
            const uploadedAt = formatDate(photo.uploaded_at);

            return `
              <div class="photo-card">
                <img src="${escapeHtml(imageUrl)}" alt="${caption}" />
                <div class="photo-meta">
                  <div class="photo-caption">${caption}</div>
                  <div class="photo-submeta">Status: ${status}</div>
                  <div class="photo-submeta">Upload: ${uploadedAt}</div>
                </div>
              </div>
            `;
          })
          .join('')
      : '<div class="empty-state">Belum ada foto untuk item ini.</div>';

    return `
      <section class="item-section">
        <div class="item-header">
          <div>
            <h2>${index + 1}. ${escapeHtml(item.name)}</h2>
            <div class="item-subtitle">
              Kategori: ${escapeHtml(item.category || '-')} | Kebutuhan foto: ${item.required_photo_count} | Foto terkumpul: ${photos.length}
            </div>
          </div>
        </div>
        ${
          item.description
            ? `<p class="item-description">${escapeHtml(item.description)}</p>`
            : ''
        }
        <div class="photo-grid">${photoCards}</div>
      </section>
    `;
  });

  return `
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(project.name)} - Report</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            color: #1f2937;
            background: #ffffff;
          }
          .page {
            padding: 32px;
          }
          .cover {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: flex-start;
            background: linear-gradient(135deg, #1f4e79, #2f6fa5);
            color: #ffffff;
            padding: 56px;
            page-break-after: always;
          }
          .cover h1 {
            margin: 0 0 12px;
            font-size: 36px;
          }
          .cover h2 {
            margin: 0 0 16px;
            font-size: 24px;
            font-weight: 400;
          }
          .cover p {
            margin: 6px 0;
            font-size: 15px;
          }
          .summary {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin: 24px 0 32px;
          }
          .summary-card {
            border: 1px solid #d1d5db;
            border-radius: 10px;
            padding: 16px;
            background: #f9fafb;
          }
          .summary-card .label {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
            margin-bottom: 8px;
          }
          .summary-card .value {
            font-size: 20px;
            font-weight: 700;
          }
          .section-title {
            font-size: 24px;
            margin: 0 0 12px;
          }
          .detail-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
          }
          .detail-table td {
            padding: 10px 12px;
            border: 1px solid #e5e7eb;
            vertical-align: top;
            font-size: 14px;
          }
          .detail-table td:first-child {
            width: 180px;
            background: #f9fafb;
            font-weight: 600;
          }
          .item-section {
            page-break-inside: avoid;
            margin-bottom: 28px;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 18px;
          }
          .item-header h2 {
            margin: 0 0 6px;
            font-size: 20px;
          }
          .item-subtitle,
          .item-description,
          .photo-submeta {
            font-size: 13px;
            color: #4b5563;
          }
          .item-description {
            margin: 10px 0 16px;
          }
          .photo-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
          .photo-card {
            border: 1px solid #d1d5db;
            border-radius: 10px;
            overflow: hidden;
            background: #ffffff;
          }
          .photo-card img {
            display: block;
            width: 100%;
            height: 220px;
            object-fit: cover;
            background: #f3f4f6;
          }
          .photo-meta {
            padding: 12px;
          }
          .photo-caption {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 6px;
          }
          .empty-state {
            border: 1px dashed #d1d5db;
            border-radius: 10px;
            padding: 24px;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <section class="cover">
          <h1>Event Monitoring System</h1>
          <h2>${escapeHtml(project.name)}</h2>
          <p>Client: ${escapeHtml(project.client_name || '-')}</p>
          <p>Lokasi: ${escapeHtml(project.location || '-')}</p>
          <p>Periode: ${formatDate(project.start_date)} - ${formatDate(project.end_date)}</p>
          <p>Status: ${escapeHtml(project.status || '-')}</p>
        </section>

        <div class="page">
          <h2 class="section-title">Ringkasan Project</h2>
          <div class="summary">
            <div class="summary-card">
              <div class="label">Total Item</div>
              <div class="value">${items.length}</div>
            </div>
            <div class="summary-card">
              <div class="label">Total Foto</div>
              <div class="value">${totalPhotos}</div>
            </div>
            <div class="summary-card">
              <div class="label">Status</div>
              <div class="value">${escapeHtml(project.status || '-')}</div>
            </div>
          </div>

          <table class="detail-table">
            <tr><td>Nama Project</td><td>${escapeHtml(project.name)}</td></tr>
            <tr><td>Client</td><td>${escapeHtml(project.client_name || '-')}</td></tr>
            <tr><td>Lokasi</td><td>${escapeHtml(project.location || '-')}</td></tr>
            <tr><td>Tanggal Mulai</td><td>${formatDate(project.start_date)}</td></tr>
            <tr><td>Tanggal Selesai</td><td>${formatDate(project.end_date)}</td></tr>
            <tr><td>Deskripsi</td><td>${escapeHtml(project.description || '-')}</td></tr>
          </table>

          ${itemSections.join('')}
        </div>
      </body>
    </html>
  `;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }

  try {
    const supabaseAdmin = createAdminClient();
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { data: items, error: itemsError } = await supabaseAdmin
      .from('items')
      .select('id, name, description, category, required_photo_count, photos(id, caption, status, thumbnail_url, drive_file_url, uploaded_at)')
      .eq('project_id', projectId)
      .order('order_index', { ascending: true });

    if (itemsError) {
      throw itemsError;
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: resolveBrowserExecutablePath(),
    });
    try {
      const page = await browser.newPage();
      await page.setContent(buildReportHtml(project, (items || []) as ItemWithPhotos[]), {
        waitUntil: 'networkidle0',
      });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px',
        },
      });

      return new NextResponse(Buffer.from(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_report.pdf"`,
        },
      });
    } finally {
      await browser.close();
    }
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

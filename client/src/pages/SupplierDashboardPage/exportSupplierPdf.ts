import type { IProcessedSupplier } from './SupplierGridSection';

// ── 字段选择 ──────────────────────────────────────────────
export interface ExportFields {
  artworks: boolean;
  styles: boolean;
  cooperationType: boolean;
  price: boolean;
  contact: boolean;
  links: boolean;
  project: boolean;
  notes: boolean;
}

export const DEFAULT_EXPORT_FIELDS: ExportFields = {
  artworks: true,
  styles: true,
  cooperationType: true,
  price: true,
  contact: true,
  links: true,
  project: true,
  notes: true,
};

export const EXPORT_FIELD_LABELS: { key: keyof ExportFields; label: string }[] = [
  { key: 'artworks',       label: '作品展示' },
  { key: 'styles',         label: '擅长风格' },
  { key: 'cooperationType',label: '合作类型' },
  { key: 'price',          label: '报价参考' },
  { key: 'contact',        label: '联系方式' },
  { key: 'links',          label: '平台链接' },
  { key: 'project',        label: '历史参与项目' },
  { key: 'notes',          label: '备注' },
];

// ── 标签映射 ──────────────────────────────────────────────
const platformLabelMap: Record<string, string> = {
  weibo: '微博', pixiv: 'Pixiv', xiaohongshu: '小红书',
  website: '官网', bilibili: 'B站', mihuashi: '米画师', x: 'X',
};
const statusLabelMap: Record<string, string> = {
  in_stock: '库内合作', outreach: '库外建联', blacklisted: '已拉黑',
};
const statusColorMap: Record<string, string> = {
  in_stock: '#16a34a', outreach: '#2563eb', blacklisted: '#6b7280',
};
const contactTypeLabels: Record<string, string> = {
  wechat: '微信', qq: 'QQ', phone: '电话',
};

function esc(text: unknown): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadImageAsDataUrl(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// ── 单个画师卡片 HTML ─────────────────────────────────────
function buildSupplierCard(
  s: IProcessedSupplier,
  artworkDataUrls: (string | null)[],
  fields: ExportFields,
): string {
  const statusLabel = statusLabelMap[s.status] || s.status;
  const statusColor = statusColorMap[s.status] || '#6b7280';
  const typeLabel = s.type;

  const stars = Array.from({ length: 5 })
    .map((_, i) =>
      `<span style="color:${i < (s.rating || 0) ? '#f59e0b' : '#e5e7eb'};font-size:18px;">★</span>`,
    )
    .join('');

  const sectionTitle = (text: string) =>
    `<div style="font-size:13px;font-weight:700;color:#0f172a;margin:0 0 8px 0;padding-left:8px;border-left:3px solid #2563eb;">${text}</div>`;

  const card = (inner: string) =>
    `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:14px;">${inner}</div>`;

  // ── 各 section ──
  const artworkBlock = fields.artworks
    ? (() => {
        const block = artworkDataUrls.length === 0
          ? '<span style="color:#9ca3af;font-size:13px;">暂无作品图片</span>'
          : `<div style="display:flex;flex-wrap:wrap;gap:8px;">${artworkDataUrls
              .map((dataUrl) =>
                dataUrl
                  ? `<img src="${dataUrl}" style="width:160px;height:160px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;" />`
                  : `<div style="width:160px;height:160px;border-radius:8px;border:1px dashed #cbd5e1;background:#f8fafc;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;text-align:center;">图片缺失</div>`,
              )
              .join('')}</div>`;
        return card(sectionTitle('作品展示') + block);
      })()
    : '';

  const stylesHtml = fields.styles
    ? (() => {
        const content = s.styles.length
          ? s.styles.map((t) => `<span style="display:inline-block;background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;border-radius:9999px;padding:2px 10px;font-size:12px;margin:0 6px 6px 0;">${esc(t)}</span>`).join('')
          : '<span style="color:#9ca3af;font-size:13px;">暂未设置</span>';
        return card(sectionTitle('擅长风格') + `<div>${content}</div>`);
      })()
    : '';

  const coopHtml = fields.cooperationType
    ? (() => {
        const content = s.cooperationTypes.length
          ? s.cooperationTypes.map((t) => `<span style="display:inline-block;background:#eff6ff;color:#1d4ed8;border:1px solid #dbeafe;border-radius:9999px;padding:2px 10px;font-size:12px;margin:0 6px 6px 0;">${esc(t)}</span>`).join('')
          : '<span style="color:#9ca3af;font-size:13px;">未设置</span>';
        return card(sectionTitle('合作类型') + `<div>${content}</div>`);
      })()
    : '';

  const priceHtml = fields.price
    ? (() => {
        const rows = s.priceItems && s.priceItems.length
          ? s.priceItems.map((p) => `<div style="display:flex;justify-content:space-between;padding:6px 4px;border-bottom:1px solid #f1f5f9;font-size:13px;"><span style="color:#475569;">${esc(p.cooperationType)}</span><span><b style="color:#2563eb;">${esc(p.unitPrice)}</b> <span style="color:#94a3b8;font-size:12px;">${esc(p.priceUnit)}</span></span></div>`).join('')
          : s.priceText
            ? `<div style="font-size:13px;color:#475569;white-space:pre-wrap;line-height:1.6;">${esc(s.priceText)}</div>`
            : '<span style="color:#9ca3af;font-size:13px;">暂无报价信息</span>';
        return card(sectionTitle('报价参考') + rows);
      })()
    : '';

  const contactHtml = fields.contact
    ? (() => {
        const rows = s.contactItems && s.contactItems.length
          ? s.contactItems.map((c) => `<div style="font-size:13px;margin-bottom:4px;"><span style="display:inline-block;min-width:42px;background:#f1f5f9;color:#475569;border-radius:4px;padding:1px 6px;font-size:12px;margin-right:8px;">${esc(contactTypeLabels[c.type] || c.type)}</span><span style="color:#1e293b;">${esc(c.value)}</span></div>`).join('')
          : '<span style="color:#9ca3af;font-size:13px;">暂无联系方式</span>';
        return card(sectionTitle('联系方式') + rows);
      })()
    : '';

  const linksHtml = fields.links
    ? (() => {
        const links = s.links || {};
        const rows = Object.keys(links).length
          ? Object.entries(links).flatMap(([platform, urls]) =>
              (urls || []).map((url) => `<div style="font-size:12px;margin-bottom:4px;word-break:break-all;"><span style="color:#475569;font-weight:600;">${esc(platformLabelMap[platform] || platform)}：</span><span style="color:#2563eb;">${esc(url)}</span></div>`),
            ).join('')
          : '<span style="color:#9ca3af;font-size:13px;">暂无平台链接</span>';
        return card(sectionTitle('平台链接') + rows);
      })()
    : '';

  const projectHtml = fields.project
    ? card(sectionTitle('历史参与项目') + (s.project && s.project.length
        ? `<div style="font-size:13px;color:#334155;">${s.project.map(esc).join('、')}</div>`
        : '<span style="color:#9ca3af;font-size:13px;">未设置</span>'))
    : '';

  const notesHtml = fields.notes
    ? card(sectionTitle('备注') + (s.notes
        ? `<div style="font-size:13px;color:#475569;white-space:pre-wrap;line-height:1.7;">${esc(s.notes)}</div>`
        : '<span style="color:#9ca3af;font-size:13px;">暂无备注</span>'))
    : '';

  // 风格 + 合作类型并列（有则显示，缺一则另一独占全宽）
  const stylesCoopRow = (fields.styles || fields.cooperationType)
    ? `<div style="display:flex;gap:14px;">${stylesHtml ? `<div style="flex:1;">${stylesHtml}</div>` : ''}${coopHtml ? `<div style="flex:1;">${coopHtml}</div>` : ''}</div>`
    : '';

  // 联系方式 + 平台链接并列
  const contactLinksRow = (fields.contact || fields.links)
    ? `<div style="display:flex;gap:14px;">${contactHtml ? `<div style="flex:1;">${contactHtml}</div>` : ''}${linksHtml ? `<div style="flex:1;">${linksHtml}</div>` : ''}</div>`
    : '';

  return `
  <div style="width:760px;padding:28px 32px;background:#f8fafc;font-family:'Microsoft YaHei','PingFang SC',sans-serif;color:#1e293b;box-sizing:border-box;">
    <!-- 头部（始终显示） -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2px solid #e2e8f0;padding-bottom:14px;margin-bottom:18px;">
      <div>
        <div style="font-size:24px;font-weight:800;color:#0f172a;margin-bottom:8px;">${esc(s.name)}</div>
        <div>
          <span style="display:inline-block;background:#eff6ff;color:#1d4ed8;border:1px solid #dbeafe;border-radius:9999px;padding:3px 12px;font-size:13px;margin-right:8px;">${esc(typeLabel)}</span>
          <span style="display:inline-block;background:${statusColor}1a;color:${statusColor};border:1px solid ${statusColor}40;border-radius:9999px;padding:3px 12px;font-size:13px;">${esc(statusLabel)}</span>
          ${s.cooperationCategory ? `<span style="display:inline-block;background:#f1f5f9;color:#475569;border-radius:9999px;padding:3px 12px;font-size:13px;margin-left:8px;">${esc(s.cooperationCategory)}</span>` : ''}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="margin-bottom:4px;">${stars}</div>
        <div style="font-size:13px;color:#64748b;">合作 <b style="color:#0f172a;">${esc(s.cooperationCount)}</b> 次</div>
      </div>
    </div>

    ${artworkBlock}
    ${stylesCoopRow}
    ${priceHtml}
    ${contactLinksRow}
    ${projectHtml}
    ${notesHtml}
  </div>`;
}

interface ExportProgress {
  onProgress?: (current: number, total: number) => void;
  fields?: ExportFields;
}

// ── 主入口：导出多个画师为单个 PDF ────────────────────────
export async function exportSuppliersToPdf(
  suppliers: IProcessedSupplier[],
  options: ExportProgress = {},
): Promise<void> {
  if (suppliers.length === 0) return;

  const fields = options.fields ?? DEFAULT_EXPORT_FIELDS;

  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.zIndex = '-1';
  document.body.appendChild(host);

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const usableW = pageW - margin * 2;
  const usableH = pageH - margin * 2;

  try {
    for (let idx = 0; idx < suppliers.length; idx++) {
      const s = suppliers[idx];
      options.onProgress?.(idx + 1, suppliers.length);

      const works = fields.artworks ? (s.works || []) : [];
      const artworkDataUrls = await Promise.all(works.map((u) => loadImageAsDataUrl(u)));

      host.innerHTML = buildSupplierCard(s, artworkDataUrls, fields);
      const cardEl = host.firstElementChild as HTMLElement;

      const canvas = await html2canvas(cardEl, {
        scale: 2,
        backgroundColor: '#f8fafc',
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const renderW = usableW;
      const renderH = (canvas.height * renderW) / canvas.width;

      if (idx > 0) pdf.addPage();

      if (renderH <= usableH) {
        pdf.addImage(imgData, 'JPEG', margin, margin, renderW, renderH);
      } else {
        const pxPerPage = (usableH * canvas.width) / renderW;
        let srcY = 0;
        let firstSlice = true;
        while (srcY < canvas.height) {
          const sliceH = Math.min(pxPerPage, canvas.height - srcY);
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = sliceH;
          const sctx = sliceCanvas.getContext('2d');
          if (sctx) {
            sctx.fillStyle = '#f8fafc';
            sctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            sctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          }
          const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.9);
          const sliceRenderH = (sliceH * renderW) / canvas.width;
          if (!firstSlice) pdf.addPage();
          pdf.addImage(sliceData, 'JPEG', margin, margin, renderW, sliceRenderH);
          srcY += sliceH;
          firstSlice = false;
        }
      }
    }

    const dateStr = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
    pdf.save(`画师档案_${dateStr}.pdf`);
  } finally {
    document.body.removeChild(host);
  }
}

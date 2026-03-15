// ============================================================
// ai.js — Renderização de resultados da IA
// Markdown renderer + utilitários de exibição
// ============================================================

// ============================================================
// MARKDOWN RENDERER
// Converte markdown simples em HTML seguro
// ============================================================
function renderMarkdown(text) {
  if (!text) return '<p style="color:#94a3b8;font-style:italic;">Sem conteúdo.</p>';

  const lines = text.split('\n');
  let html  = '';
  let inUl  = false;

  lines.forEach(rawLine => {
    const line = rawLine.trim();

    if (line.startsWith('* ') || line.startsWith('- ')) {
      if (!inUl) { html += '<ul class="md-list">'; inUl = true; }
      html += `<li>${processBoldAndLinks(esc(line.substring(2)))}</li>`;
      return;
    }
    if (inUl) { html += '</ul>'; inUl = false; }

    if (line === '') { return; }
    if (line.startsWith('### ')) { html += `<h3 class="md-h3">${esc(line.substring(4))}</h3>`; return; }
    if (line.startsWith('## '))  { html += `<h2 class="md-h2">${esc(line.substring(3))}</h2>`; return; }
    if (line.startsWith('# '))   { html += `<h1 class="md-h1">${esc(line.substring(2))}</h1>`; return; }
    html += `<p class="md-p">${processBoldAndLinks(esc(line))}</p>`;
  });

  if (inUl) html += '</ul>';
  return html;
}

function processBoldAndLinks(text) {
  // Bold: **text** → <strong>
  return text.replace(/\*\*(.*?)\*\*/g, '<strong class="md-bold">$1</strong>');
}

// ============================================================
// RENDERIZAR FONTES DE PESQUISA
// ============================================================
function renderizarFontes(containerId, sources) {
  const div = document.getElementById(containerId);
  if (!div) return;

  if (!sources || sources.length === 0) {
    div.style.display = 'none';
    return;
  }

  div.style.display = 'block';
  div.innerHTML = `
    <div class="sources-block">
      <p class="sources-label">
        <i data-lucide="link" style="width:11px;height:11px;"></i>
        Fontes de Pesquisa
      </p>
      <ul class="sources-list">
        ${sources.map(s => `
          <li>
            <a href="${esc(s.uri)}" target="_blank" rel="noopener noreferrer" class="source-link">
              <i data-lucide="external-link" style="width:11px;height:11px;flex-shrink:0;"></i>
              ${esc(s.title || s.uri)}
            </a>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
  lucide.createIcons({ nodes: [div] });
}

// ============================================================
// LIMPAR TEXTO PARA COPIAR (sem markdown)
// ============================================================
function limparMarkdownParaCopiar(text) {
  return text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^[*\-]\s/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============================================================
// COPIAR PARA CLIPBOARD
// ============================================================
async function copiarParaClipboard(text, btnId) {
  const limpo = limparMarkdownParaCopiar(text);
  const btn   = document.getElementById(btnId);

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(limpo);
    } else {
      const ta = document.createElement('textarea');
      ta.value = limpo;
      ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }

    if (btn) {
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<i data-lucide="check" style="width:14px;height:14px;"></i> Copiado!';
      btn.style.background = 'var(--green-600)';
      btn.style.color = '#fff';
      lucide.createIcons({ nodes: [btn] });
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.style.background = '';
        btn.style.color = '';
        lucide.createIcons({ nodes: [btn] });
      }, 2200);
    }

    mostrarToast('Copiado para a área de transferência!', 'success');
  } catch (e) {
    mostrarToast('Erro ao copiar. Tente manualmente.', 'error');
  }
}

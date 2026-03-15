# 📚 Biblioteca de Ananias — BiblioA

Sistema de gestão de biblioteca pessoal com IA generativa.
PWA instalável no telemóvel, backend no Google Apps Script.

---

## ✨ Funcionalidades

- **Cadastro de livros** com capa automática via Google Books
- **Catálogo completo** com vista em lista e galeria de capas
- **Busca e ordenação** em tempo real
- **Recomendações IA** (Gemini 2.5 Flash + Google Search)
- **A.N.A.N.I.A.S.** — síntese estruturada de qualquer livro
- **Categorias** personalizáveis com drag-and-drop
- **PWA instalável** no telemóvel (Android e iOS)
- **Modo offline** — leitura do cache local sem internet
- **Export/Import CSV** para backup e migração

---

## 🚀 Instalação

### 1. Google Apps Script (Backend)

1. Acesse [script.google.com](https://script.google.com) e crie um novo projecto
2. Cole o conteúdo de `Code.gs` no editor
3. Crie uma Google Sheet e copie o ID da URL (`...spreadsheets/d/**ID**/edit`)
4. Em **Projecto → Propriedades do Script**, adicione:
   - `SHEET_ID` → ID da sua Google Sheet
   - `GEMINI_API_KEY` → sua chave da [Google AI Studio](https://aistudio.google.com)
5. **Implementar → Nova implementação → Web App**
   - Execute as: **Me**
   - Access: **Anyone**
6. Copie a **URL da aplicação web** (será usada na configuração da PWA)

### 2. GitHub Pages (Frontend)

1. Faça fork ou clone deste repositório
2. Active o GitHub Pages: **Settings → Pages → Source → GitHub Actions**
3. Faça push para a branch `main` — o deploy é automático

### 3. Configuração inicial

1. Abra a URL do GitHub Pages no telemóvel
2. Navegue para a aba **Config**
3. Cole a URL do GAS e clique em **Guardar e Conectar**
4. Clique em **Instalar** quando o banner aparecer (ou use "Adicionar ao Ecrã Inicial" no iOS)

---

## 📁 Estrutura do Repositório

```
/
├── index.html              # PWA principal
├── manifest.json           # Manifesto PWA
├── sw.js                   # Service Worker (cache offline)
├── Code.gs                 # Backend Google Apps Script
├── css/
│   └── style.css           # Estilos completos
├── js/
│   ├── app.js              # Lógica principal + CRUD
│   ├── api.js              # Comunicação com o GAS
│   ├── ai.js               # Renderização markdown + IA
│   ├── ui.js               # Componentes de UI
│   └── db.js               # Cache IndexedDB + localStorage
├── icons/                  # Ícones PWA (gerar com script abaixo)
└── .github/
    └── workflows/
        └── deploy.yml      # CI/CD automático
```

---

## 🎨 Gerar Ícones PWA

Os ícones devem ser gerados a partir da imagem `https://i.ibb.co/qYFVxhkm/image.png`.

**Opção rápida online:**
1. Acesse [realfavicongenerator.net](https://realfavicongenerator.net)
2. Faça upload da imagem do Ananias
3. Descarregue o pacote e coloque os ficheiros em `/icons/`

**Tamanhos necessários:** 72, 96, 128, 144, 152, 192, 384, 512 px

---

## 🔑 Segurança

- A chave Gemini fica **100% protegida** no GAS (nunca exposta ao browser)
- O GAS actua como proxy autenticado para o Google Sheets
- Os dados ficam na **sua** Google Sheet pessoal
- O modo offline usa IndexedDB local (apenas leitura)

---

## 📱 Instalar no iOS (Safari)

1. Abra a URL no Safari
2. Toque no ícone de partilha ↑
3. "Adicionar ao Ecrã de Início"
4. Confirme com "Adicionar"

## 📱 Instalar no Android (Chrome)

O banner de instalação aparece automaticamente após 3 segundos.
Ou: Menu Chrome → "Adicionar ao Ecrã Inicial"

---

*Biblioteca de Ananias — de pai para filho, de humano para máquina.*

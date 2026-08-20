# Documentação Completa do Sistema de Rastreamento
**Clínica Pollyany Policarpo Odontologia**

Este documento descreve toda a arquitetura de rastreamento implementada no arquivo `tracking.js`, compartilhada por todas as páginas do site (árvore de links na raiz, páginas individuais dos doutores e as 3 landing pages de conversão).

---

## 1. Como Ativar as Plataformas de Anúncio e Métricas

No início do arquivo `tracking.js` na raiz do site, localize o bloco `TRACKING_CONFIG`:

```javascript
const TRACKING_CONFIG = {
  metaPixelId: '',        // Exemplo: '987654321098765'
  googleAdsId: '',        // Exemplo: 'AW-123456789'
  googleAdsConversao: '', // Exemplo: 'AW-123456789/AbC-D_efGh'
  ga4Id: '',              // Exemplo: 'G-XXXXXXXXXX'
  debug: false,           // true para testes no console, false para produção
};
```

### Comportamento:
- Se qualquer campo estiver vazio (`''`), a ferramenta correspondente **não é carregada**, garantindo 0 erros de requisição e 0 impacto na velocidade da página.
- Quando preenchido e aceito pelo banner de LGPD, o script injeta as tags oficiais assincronamente sem necessidade de alterar o HTML das páginas.
- O `window.dataLayer` é sempre alimentado, permitindo plugar Google Tag Manager (GTM) a qualquer momento sem alterações de código.

---

## 2. Eventos Automáticos Compartilhados em Todas as Páginas

Todos os eventos abaixo enviam automaticamente os seguintes **parâmetros base**:
- `page_path`: Caminho da página atual (ex.: `/`, `/equipe/dra-pollyany-policarpo/`, `/implante/`)
- `page_title`: Título da tag `<title>` da página
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`: Parâmetros da URL capturados e persistidos via `sessionStorage`.

---

### 2.1 Eventos de Conversão e Cliques em Botões

| Nome do Evento | Disparo | `data-track-local` | Parâmetros Adicionais | Ação nas Plataformas |
|---|---|---|---|---|
| `clique_whatsapp` | Clique em qualquer botão de WhatsApp | `arvore_principal`, `doutor_[slug]`, `implante_topo`, `implante_final`, etc. | `link_text`, `link_url`, `local` | **Meta:** dispara `fbq('track', 'Contact')` + `trackCustom`<br>**Google Ads:** dispara evento de conversão `conversion` configurado |
| `clique_localizacao` | Clique no botão "Como chegar" / "Ver rotas" | `arvore`, `implante`, etc. | `link_text`, `link_url`, `local` | `trackCustom` / GA4 event |
| `clique_doutor` | Clique no card de um doutor na árvore | `dra-pollyany-policarpo`, `dr-naydson-pereira`, etc. | `link_text`, `link_url`, `local` | `trackCustom` / GA4 event |
| `clique_procedimento` | Clique em procedimento na árvore | `implante`, `alinhador`, `preenchimento_labial` | `link_text`, `link_url`, `local` | `trackCustom` / GA4 event |
| `clique_rede_social` | Clique em redes sociais | `instagram_clinica`, `instagram_doutora`, `facebook` | `link_text`, `link_url`, `local` | `trackCustom` / GA4 event |
| `clique_avaliacao` | Clique no selo 5,0 ou no botão "Deixe sua avaliação" | `selo`, `arvore` | `link_text`, `link_url`, `local` | `trackCustom` / GA4 event |
| `clique_voltar` | Clique em "Voltar" na página do doutor | `[slug-do-doutor]` | `link_text`, `link_url`, `local` | `trackCustom` / GA4 event |

---

### 2.2 Tempo Ativo de Permanência na Página (Active Tab Time)

Medido **apenas enquanto a aba estiver visível e em foco** pelo usuário (pausado automaticamente via `visibilitychange` quando o usuário minimiza ou troca de aba):

| Nome do Evento | Quando Dispara | Parâmetros |
|---|---|---|
| `tempo_15s` | Ao acumular 15 segundos ativos na página | `segundos_ativos: 15` |
| `tempo_30s` | Ao acumular 30 segundos ativos na página | `segundos_ativos: 30` |
| `tempo_60s` | Ao acumular 60 segundos (1 min) ativos na página | `segundos_ativos: 60` |
| `tempo_120s` | Ao acumular 120 segundos (2 min) ativos na página | `segundos_ativos: 120` |
| `tempo_180s` | Ao acumular 180 segundos (3 min) ativos na página | `segundos_ativos: 180` |
| `tempo_total` | Ao sair da página (`pagehide` com `navigator.sendBeacon`) | `segundos: [total_acumulado]` |

---

### 2.3 Profundidade de Rolagem (Scroll Depth)

Implementado com sentinelas invisíveis e `IntersectionObserver` (alta performance sem travar a rolagem mobile):

| Nome do Evento | Quando Dispara | Parâmetros |
|---|---|---|
| `scroll_25` | Ao atingir 25% da altura da página (1 única vez) | `profundidade: "25%"` |
| `scroll_50` | Ao atingir 50% da altura da página (1 única vez) | `profundidade: "50%"` |
| `scroll_75` | Ao atingir 75% da altura da página (1 única vez) | `profundidade: "75%"` |
| `scroll_90` | Ao atingir 90% da altura da página (1 única vez) | `profundidade: "90%"` |

---

### 2.4 Eventos de Vídeo (YouTube IFrame API & `<video>` Nativo)

| Nome do Evento | Quando Dispara | Parâmetros |
|---|---|---|
| `video_play` | Quando o usuário inicia a reprodução do vídeo | `video: "clinica"` ou slug do doutor / procedimento |
| `video_25` | Quando a reprodução atinge 25% da duração | `video: [nome]`, `progresso: "25%"` |
| `video_50` | Quando a reprodução atinge 50% da duração | `video: [nome]`, `progresso: "50%"` |
| `video_75` | Quando a reprodução atinge 75% da duração | `video: [nome]`, `progresso: "75%"` |
| `video_completo`| Quando o vídeo chega até o fim | `video: [nome]` |
| `video_pausa` | Quando o usuário pausa o vídeo | `video: [nome]`, `tempo_decorrido: [segundos]` |

---

## 3. Repasse Automático de UTMs para Links Internos

Quando um visitante chega com parâmetros de anúncio na URL, por exemplo:
`https://pollyanypolicarpo.com.br/?utm_source=instagram&utm_medium=cpc&utm_campaign=institucional_sao_pedro`

O `tracking.js`:
1. Salva essas informações em `sessionStorage` para durar toda a sessão.
2. Anexa automaticamente esses parâmetros em todos os links internos (botões para os procedimentos `/implante/`, `/alinhador/`, `/preenchimento-labial/` e páginas de equipe `/equipe/dra-pollyany-policarpo/`).
3. Assim, quando o usuário clica para agendar pelo WhatsApp dentro de qualquer página interna, a origem exata da campanha não se perde nos relatórios.

---

## 4. Política de Privacidade e Consentimento LGPD

- O banner de cookies solicita consentimento para medição e anúncios.
- A decisão é armazenada em `localStorage` sob a chave `cp_lgpd_consent`.
- Se recusado ou não respondido, tags externas de rastreamento (Meta Pixel, Google Ads) não são carregadas, garantindo conformidade com a LGPD e evitando que cookies de terceiros sejam depositados sem autorização.
- Eventos locais e internos continuam funcionando para navegação e integridade técnica.

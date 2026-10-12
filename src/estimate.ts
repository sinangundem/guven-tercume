type Language = { code: string; name: string }
type Estimate = { wordCount: number; ratePerWord: number; estimatedTotal: number; currency: string }
type Preview = { previewId: string; wordCount: number; detectedLanguage: string | null; fileName: string }

const form = document.querySelector<HTMLFormElement>('#estimate-form')!
const fileInput = document.querySelector<HTMLInputElement>('#document-file')!
const sourceSelect = document.querySelector<HTMLSelectElement>('#source-language')!
const targetSelect = document.querySelector<HTMLSelectElement>('#target-language')!
const submitButton = document.querySelector<HTMLButtonElement>('#quote-submit')!
const fileStatus = document.querySelector<HTMLParagraphElement>('#file-status')!
const countLabel = document.querySelector<HTMLSpanElement>('#word-count')!
const totalLabel = document.querySelector<HTMLElement>('#estimate-total')!
const estimateNote = document.querySelector<HTMLElement>('#estimate-note')!
const formMessage = document.querySelector<HTMLParagraphElement>('#form-message')!
const languageNames = new Intl.DisplayNames(['tr'], { type: 'language' })
let preview: Preview | null = null
let languages: Language[] = []
let calculating = false

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'İstek tamamlanamadı.')
  return result as T
}

function showMessage(message: string, kind: 'error' | 'success' = 'error') {
  formMessage.textContent = message
  formMessage.className = `form-message ${kind}`
}

function displayLanguage(language: Language) {
  const localized = languageNames.of(language.code)
  return localized && localized.toLocaleLowerCase('tr') !== language.code ? localized : language.name
}

function fillLanguageOptions(select: HTMLSelectElement, placeholder: string) {
  select.replaceChildren(new Option(placeholder, ''))
  for (const language of languages) {
    select.add(new Option(displayLanguage(language), language.code))
  }
}

function refreshSubmitState() {
  submitButton.disabled = !preview || !sourceSelect.value || !targetSelect.value || calculating
}

async function refreshEstimate() {
  if (!preview || !sourceSelect.value || !targetSelect.value) {
    countLabel.textContent = `Sözcük sayısı: ${preview?.wordCount ?? '-'}`
    totalLabel.textContent = 'Tahmini tutar: -'
    estimateNote.textContent = 'Tarife kaynak dile göre hesaplanır.'
    refreshSubmitState()
    return
  }

  calculating = true
  refreshSubmitState()
  try {
    const estimate = await request<Estimate>('/api/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        previewId: preview.previewId,
        sourceLanguage: sourceSelect.value,
        targetLanguage: targetSelect.value,
      }),
    })
    const formattedTotal = new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: estimate.currency,
    }).format(estimate.estimatedTotal)
    countLabel.textContent = `${estimate.wordCount.toLocaleString('tr-TR')} sözcük`
    totalLabel.textContent = `Tahmini tutar: ${formattedTotal}`
    estimateNote.textContent = `${estimate.ratePerWord.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL / sözcük · kesin fiyat belge kontrolünden sonra belirlenir.`
  } catch (error) {
    showMessage(error instanceof Error ? error.message : 'Fiyat hesaplanamadı.')
    totalLabel.textContent = 'Tahmini tutar: -'
  } finally {
    calculating = false
    refreshSubmitState()
  }
}

async function analyzeFile(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  preview = null
  sourceSelect.disabled = true
  targetSelect.disabled = true
  refreshSubmitState()
  formMessage.textContent = ''
  totalLabel.textContent = 'Tahmini tutar: -'
  countLabel.textContent = 'Sözcük sayısı: -'
  if (!file) {
    fileStatus.textContent = 'Dosya analiz edildiğinde sözcük sayısı burada görünür.'
    return
  }

  fileStatus.textContent = `${file.name} analiz ediliyor...`
  const payload = new FormData()
  payload.append('document', file)
  try {
    const result = await request<Preview>('/api/estimate/preview', { method: 'POST', body: payload })
    preview = result
    countLabel.textContent = `${result.wordCount.toLocaleString('tr-TR')} sözcük`
    if (result.detectedLanguage) {
      sourceSelect.value = result.detectedLanguage
      fileStatus.textContent = `${result.fileName} · Algılanan dil: ${displayLanguage(languages.find(({ code }) => code === result.detectedLanguage)!)}`
    } else {
      sourceSelect.value = ''
      fileStatus.textContent = `${result.fileName} · Dil otomatik belirlenemedi; listeden seçin.`
    }
    targetSelect.value = sourceSelect.value === 'tr' ? 'en' : 'tr'
    sourceSelect.disabled = false
    targetSelect.disabled = false
    showMessage('Dosya analiz edildi. Dil seçimlerini kontrol edip iletişim bilgilerinizi girin.', 'success')
    await refreshEstimate()
  } catch (error) {
    fileStatus.textContent = file.name
    showMessage(error instanceof Error ? error.message : 'Dosya analiz edilemedi.')
  }
}

async function submitQuote(event: Event) {
  event.preventDefault()
  if (!preview) {
    showMessage('Önce belgenizi yükleyin.')
    return
  }
  const fields = new FormData(form)
  const body = {
    previewId: preview.previewId,
    customerName: fields.get('customerName'),
    email: fields.get('email'),
    phone: fields.get('phone'),
    note: fields.get('note'),
    sourceLanguage: sourceSelect.value,
    targetLanguage: targetSelect.value,
    privacyConsent: fields.get('privacyConsent') === 'on',
  }
  submitButton.disabled = true
  submitButton.textContent = 'Talep gönderiliyor...'
  try {
    const result = await request<{ id: string; estimatedTotal: number; notificationStatus: string }>('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const emailMessage = result.notificationStatus === 'sent'
      ? 'Talebiniz kaydedildi ve Güven Tercüme’ye e-posta ile iletildi.'
      : result.notificationStatus === 'smtp_not_configured'
        ? 'Talebiniz kaydedildi. E-posta bildirimi yapılandırılmadığı için yönetici panelinden takip edilecek.'
        : 'Talebiniz kaydedildi ancak e-posta gönderilemedi. Yönetici panelinden takip edilecek.'
    showMessage(`${emailMessage} Talep numarası: ${result.id.slice(0, 8).toUpperCase()}`, 'success')
    form.reset()
    preview = null
    fileStatus.textContent = 'Dosya analiz edildiğinde sözcük sayısı burada görünür.'
    countLabel.textContent = 'Sözcük sayısı: -'
    totalLabel.textContent = 'Tahmini tutar: -'
    estimateNote.textContent = 'Tarife kaynak dile göre hesaplanır.'
    sourceSelect.disabled = true
    targetSelect.disabled = true
  } catch (error) {
    showMessage(error instanceof Error ? error.message : 'Talep kaydedilemedi.')
  } finally {
    submitButton.textContent = 'Teklif talebi gönder'
    refreshSubmitState()
  }
}

async function initialize() {
  try {
    const config = await request<{ languages: Language[] }>('/api/config')
    languages = config.languages
    fillLanguageOptions(sourceSelect, 'Kaynak dili seçin')
    fillLanguageOptions(targetSelect, 'Hedef dili seçin')
  } catch (error) {
    showMessage(error instanceof Error ? error.message : 'Dil listesi yüklenemedi.')
  }
}

fileInput.addEventListener('change', (event) => void analyzeFile(event))
sourceSelect.addEventListener('change', () => void refreshEstimate())
targetSelect.addEventListener('change', () => void refreshEstimate())
form.addEventListener('submit', (event) => void submitQuote(event))

const uploadLabel = document.querySelector<HTMLElement>('.upload-label')!
for (const eventName of ['dragenter', 'dragover']) {
  uploadLabel.addEventListener(eventName, (event) => {
    event.preventDefault()
    uploadLabel.classList.add('dragging')
  })
}
for (const eventName of ['dragleave', 'drop']) {
  uploadLabel.addEventListener(eventName, (event) => {
    event.preventDefault()
    uploadLabel.classList.remove('dragging')
  })
}
uploadLabel.addEventListener('drop', (event) => {
  const file = (event as DragEvent).dataTransfer?.files[0]
  if (!file) return
  const transfer = new DataTransfer()
  transfer.items.add(file)
  fileInput.files = transfer.files
  fileInput.dispatchEvent(new Event('change', { bubbles: true }))
})

void initialize()

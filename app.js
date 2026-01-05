const width = 8
const board = document.getElementById('board')
const scoreDisplay = document.getElementById('score')
const restartBtn = document.getElementById('restart')
const candyTypes = ['🍒','🍋','🍇','🍊','🍓','🥝']
let squares = []
let score = 0
let gameOver = false

// --- Audio manager -------------------------------------------------
class AudioManager{
  constructor(){
    // prefer on-disk sound files under assets/sounds/*.wav; if missing, fall back to generated data-URIs
    const tryFileThenGenerated = (name, freq, dur)=>{
      const filePath = `assets/sounds/${name}.wav`
      const el = this._makeAudio(filePath)
      // if load fails, swap to generated data URI
      el.addEventListener('error', ()=>{
        el.src = this._beepDataURI(freq, dur)
        this._missing[name] = true
      })
      return el
    }
    this.sounds = {
      swap: tryFileThenGenerated('swap', 880, 0.10),
      match: tryFileThenGenerated('match', 660, 0.16),
      bump: tryFileThenGenerated('bump', 330, 0.08),
      restart: tryFileThenGenerated('restart', 1100, 0.20),
      select: tryFileThenGenerated('select', 1200, 0.06),
      gameover: tryFileThenGenerated('gameover', 220, 0.7)
    }
    this.volume = Number(localStorage.getItem('cr_volume')) || 0.8
    this.muted = localStorage.getItem('cr_muted') === 'true' || false
    this.setVolume(this.volume)
    this.setMuted(this.muted)

    // WebAudio fallback for when files aren't present or autoplay is blocked
    this._AudioContext = window.AudioContext || window.webkitAudioContext || null
    this.audioCtx = this._AudioContext ? new this._AudioContext() : null
    this._missing = {} // track missing files

    // attach error listeners to audio elements to detect missing files
    Object.entries(this.sounds).forEach(([k, el])=>{
      if(!el) return
      el.addEventListener('error', ()=>{
        this._missing[k] = true
      })
    })

    // unlock audio context on first user gesture
    const unlock = ()=>{
      if(this.audioCtx && this.audioCtx.state === 'suspended'){
        this.audioCtx.resume().catch(()=>{})
      }
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('touchstart', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('touchstart', unlock)
  }
  _makeAudio(path){
    const a = new Audio(path)
    a.preload = 'auto'
    return a
  }

  // create a short mono 16-bit PCM WAV data URI (sampleRate 22050)
  _beepDataURI(freq, durationSec){
    const sr = 22050
    const n = Math.floor(sr * durationSec)
    const maxAmp = 0.6
    const samples = new Int16Array(n)
    for(let i=0;i<n;i++){
      const t = i/sr
      // simple sine with exponential decay
      const env = Math.exp(-6 * t)
      const s = Math.sin(2*Math.PI*freq*t) * env * maxAmp
      samples[i] = Math.max(-1, Math.min(1, s)) * 0x7fff
    }

    // WAV header
    const bytesPerSample = 2
    const blockAlign = bytesPerSample * 1
    const byteRate = sr * blockAlign
    const dataSize = samples.length * bytesPerSample
    const buffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(buffer)
    let offset = 0
    function writeString(s){ for(let i=0;i<s.length;i++){ view.setUint8(offset++, s.charCodeAt(i)) } }
    writeString('RIFF')
    view.setUint32(offset, 36 + dataSize, true); offset += 4
    writeString('WAVE')
    writeString('fmt ')
    view.setUint32(offset, 16, true); offset += 4 // fmt chunk size
    view.setUint16(offset, 1, true); offset += 2 // PCM
    view.setUint16(offset, 1, true); offset += 2 // channels
    view.setUint32(offset, sr, true); offset += 4
    view.setUint32(offset, byteRate, true); offset += 4
    view.setUint16(offset, blockAlign, true); offset += 2
    view.setUint16(offset, 16, true); offset += 2 // bits/sample
    writeString('data')
    view.setUint32(offset, dataSize, true); offset += 4
    // PCM samples
    for(let i=0;i<samples.length;i++){
      view.setInt16(offset, samples[i], true); offset += 2
    }

    // convert to base64
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
    }
    const b64 = btoa(binary)
    return 'data:audio/wav;base64,' + b64
  }
  setVolume(v){
    this.volume = v
    Object.values(this.sounds).forEach(s=>{ if(s) s.volume = v })
    localStorage.setItem('cr_volume', String(v))
  }
  setMuted(m){
    this.muted = m
    Object.values(this.sounds).forEach(s=>{ if(s) s.muted = m })
    localStorage.setItem('cr_muted', String(m))
  }
  play(name){
    const s = this.sounds[name]
    // if element missing, or play fails, fallback to WebAudio beep
    if(!s || this._missing[name]){
      this._playFallback(name)
      return
    }
    try{ s.currentTime = 0 }catch(e){}
    s.play().catch(()=> this._playFallback(name))
  }

  _playFallback(name){
    if(!this.audioCtx) return
    const now = this.audioCtx.currentTime
    const o = this.audioCtx.createOscillator()
    const g = this.audioCtx.createGain()
    const map = { swap:880, match:660, bump:440, restart:1000, select:1200 }
    const freq = map[name] || 600
    o.frequency.value = freq
    o.type = 'sine'
    g.gain.value = Math.max(0, Math.min(1, this.volume)) * (this.muted ? 0 : 0.12)
    o.connect(g)
    g.connect(this.audioCtx.destination)
    o.start(now)
    // short click-like envelope
    g.gain.setValueAtTime(g.gain.value, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
    o.stop(now + 0.14)
  }
}

const audio = new AudioManager()
// -------------------------------------------------------------------

function randomCandy(){
  return candyTypes[Math.floor(Math.random()*candyTypes.length)]
}

function createBoard(){
  board.innerHTML = ''
  squares = []
  for(let i=0;i<width*width;i++){
    const tile = document.createElement('div')
    tile.className = 'tile'
    tile.draggable = true
    tile.id = i
    tile.textContent = randomCandy()

    tile.addEventListener('dragstart', dragStart)
    tile.addEventListener('dragover', dragOver)
    tile.addEventListener('drop', dragDrop)
    tile.addEventListener('dragend', dragEnd)
      tile.addEventListener('click', handleClick)

    board.appendChild(tile)
    squares.push(tile)
  }
  // after initial fill, check for available moves
  setTimeout(()=> checkGameOver(), 80)
}

let dragSrc = null
let firstSelected = null

function dragStart(e){
  if(typeof gameOver !== 'undefined' && gameOver) return
  dragSrc = this
  e.dataTransfer.setData('text/plain', this.id)
}
function dragOver(e){ e.preventDefault() }
function dragDrop(e){
  e.preventDefault()
  const src = dragSrc
  const dest = this
  if(!src || !isAdjacent(Number(src.id), Number(dest.id))) return
  swapTiles(src, dest)
  audio.play('swap')
  const matched = resolveMatches()
  if(!matched){
    swapTiles(src, dest)
    audio.play('bump')
  }
}
function dragEnd(){ dragSrc = null }

function isAdjacent(a,b){
  const validMoves = [a-1, a+1, a-width, a+width]
  return validMoves.includes(b) && !(a%width===0 && b===a-1) && !(a%width===width-1 && b===a+1)
}

function swapTiles(a,b){
  const tmp = a.textContent
  a.textContent = b.textContent
  b.textContent = tmp
}

function hasAvailableMoves(){
  for(let i=0;i<squares.length;i++){
    const moves = [i-1,i+1,i-width,i+width]
    for(const j of moves){
      if(j<0||j>=squares.length) continue
      if(i%width===0 && j===i-1) continue
      if(i%width===width-1 && j===i+1) continue
      const a = squares[i].textContent
      const b = squares[j].textContent
      if(!a || !b) continue
      squares[i].textContent = b
      squares[j].textContent = a
      const groups = findMatches()
      squares[i].textContent = a
      squares[j].textContent = b
      if(groups.length) return true
    }
  }
  return false
}

function checkGameOver(){
  if(!hasAvailableMoves()) showGameOver()
}

function showGameOver(){
  gameOver = true
  const ov = document.getElementById('gameOver')
  if(ov) ov.classList.remove('hidden')
  audio.play('gameover')
}

function hideGameOver(){
  gameOver = false
  const ov = document.getElementById('gameOver')
  if(ov) ov.classList.add('hidden')
}

function handleClick(e){
  if(typeof gameOver !== 'undefined' && gameOver) return
  const tile = this
  if(firstSelected === tile){
    tile.classList.remove('selected')
    firstSelected = null
    audio.play('select')
    return
  }
  if(!firstSelected){
    firstSelected = tile
    tile.classList.add('selected')
    audio.play('select')
    return
  }

  const a = firstSelected
  const b = tile
  // clear selection visuals
  a.classList.remove('selected')
  firstSelected = null

  // only allow adjacent swaps
  if(!isAdjacent(Number(a.id), Number(b.id))) {
    // if not adjacent, set new selection
    firstSelected = b
    b.classList.add('selected')
    return
  }

  swapTiles(a,b)
  audio.play('swap')
  const matched = resolveMatches()
  if(!matched){
    // revert if no match
    setTimeout(()=> swapTiles(a,b), 180)
    setTimeout(()=> audio.play('bump'), 180)
  }
}

function findMatches(){
  const groups = []

  // Row of four
  for(let i=0;i<width*width;i++){
    const rowEnd = i % width > width - 4
    if(rowEnd) continue
    const t1 = squares[i].textContent
    if(!t1) continue
    if(t1 === squares[i+1].textContent && t1 === squares[i+2].textContent && t1 === squares[i+3].textContent){
      groups.push([i,i+1,i+2,i+3])
    }
  }

  // Row of three
  for(let i=0;i<width*width;i++){
    const rowEnd = i % width > width - 3
    if(rowEnd) continue
    const t1 = squares[i].textContent
    if(!t1) continue
    if(t1 === squares[i+1].textContent && t1 === squares[i+2].textContent){
      groups.push([i,i+1,i+2])
    }
  }

  // Column of four
  for(let i=0;i<width*width-3*width;i++){
    const t1 = squares[i].textContent
    if(!t1) continue
    if(t1 === squares[i+width].textContent && t1 === squares[i+2*width].textContent && t1 === squares[i+3*width].textContent){
      groups.push([i,i+width,i+2*width,i+3*width])
    }
  }

  // Column of three
  for(let i=0;i<width*width-2*width;i++){
    const t1 = squares[i].textContent
    if(!t1) continue
    if(t1 === squares[i+width].textContent && t1 === squares[i+2*width].textContent){
      groups.push([i,i+width,i+2*width])
    }
  }

  return groups
}

function highlightAndClear(groups){
  const indices = Array.from(new Set(groups.reduce((acc, g) => acc.concat(g), [])))
  indices.forEach(i=> squares[i].classList.add('flashing'))

  // play match/clear sound
  audio.play('match')

  setTimeout(()=>{
    // clear visuals then cells
    indices.forEach(i=>{
      squares[i].classList.remove('flashing')
      squares[i].textContent = ''
    })

    // simple scoring: 10 points per cleared tile
    score += indices.length * 10
    updateScore()

    collapseBoard()

    // allow cascades
    setTimeout(()=>{
        const next = findMatches()
        if(next.length) highlightAndClear(next)
        else checkGameOver()
    }, 160)
  }, 380)
}

function resolveMatches(){
  const groups = findMatches()
  if(groups.length){
    highlightAndClear(groups)
    return true
  }
  return false
}

function collapseBoard(){
  for(let i=width;i<width*width;i++){
    if(squares[i].textContent === ''){
      let above = i - width
      while(above >= 0 && squares[above].textContent === ''){
        above -= width
      }
      if(above >= 0){
        squares[i].textContent = squares[above].textContent
        squares[above].textContent = ''
      }
    }
  }

  // fill top
  for(let i=0;i<width;i++){
    if(squares[i].textContent === '') squares[i].textContent = randomCandy()
  }
}


function updateScore(){ scoreDisplay.textContent = score }

restartBtn.addEventListener('click', ()=>{
  audio.play('restart')
  score = 0
  updateScore()
  createBoard()
})

createBoard()

// wire up sound controls (mute + volume)
const muteBtn = document.getElementById('mute')
const volumeSlider = document.getElementById('volume')
if(muteBtn && volumeSlider){
  volumeSlider.value = audio.volume
  muteBtn.textContent = audio.muted ? '🔇' : '🔊'
  volumeSlider.addEventListener('input', (e)=>{
    const v = Number(e.target.value)
    audio.setVolume(v)
    if(audio.muted && v > 0) audio.setMuted(false)
    muteBtn.textContent = audio.muted ? '🔇' : '🔊'
  })
  muteBtn.addEventListener('click', ()=>{
    audio.setMuted(!audio.muted)
    muteBtn.textContent = audio.muted ? '🔇' : '🔊'
  })
  const overlayRestart = document.getElementById('overlay-restart')
  if(overlayRestart){
    overlayRestart.addEventListener('click', ()=>{
      hideGameOver()
      // trigger the regular restart behavior
      restartBtn.click()
    })
  }
}

// keep the board resolving continuously for easy play
setInterval(()=>{
  const changed = resolveMatches()
  if(changed) updateScore()
}, 400)

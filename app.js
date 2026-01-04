const width = 8
const board = document.getElementById('board')
const scoreDisplay = document.getElementById('score')
const restartBtn = document.getElementById('restart')
const candyTypes = ['🍒','🍋','🍇','🍊','🍓','🥝']
let squares = []
let score = 0

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
}

let dragSrc = null
let firstSelected = null

function dragStart(e){
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
  const matched = resolveMatches()
  if(!matched){ swapTiles(src, dest) }
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

function handleClick(e){
  const tile = this
  if(firstSelected === tile){
    tile.classList.remove('selected')
    firstSelected = null
    return
  }
  if(!firstSelected){
    firstSelected = tile
    tile.classList.add('selected')
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
  const matched = resolveMatches()
  if(!matched){
    // revert if no match
    setTimeout(()=> swapTiles(a,b), 180)
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
  score = 0
  updateScore()
  createBoard()
})

createBoard()

// keep the board resolving continuously for easy play
setInterval(()=>{
  const changed = resolveMatches()
  if(changed) updateScore()
}, 400)

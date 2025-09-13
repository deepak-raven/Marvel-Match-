import { candyMappings, colorBombUrl } from './candies.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Existing constants remain the same ---
    const modalTitle = document.getElementById('modal-title');
    const restartButton = document.getElementById('restart-button');
    const boardElement = document.getElementById('game-board');
    const scoreElement = document.getElementById('score');
    const movesElement = document.getElementById('moves');
    const modal = document.getElementById('modal');
    
    const bgMusic = new Audio('audio/bg-music.mp3');
    bgMusic.loop = true;

    const swapSound = new Audio('audio/swap.ogg');
    const negativeSwapSound = new Audio('audio/negative-swap.ogg');
    
    const boardSize = 8;
    const initialMoves = 30;
    
    const allNormalCandies = candyMappings.map(c => c.normal);
    let board = [];
    let score = 0;
    let moves = initialMoves;
    let isProcessing = false;
    let musicStarted = false;
    
    // --- NEW: Variables for Swipe Controls ---
    let selectedCandy = null;
    let startX = 0;
    let startY = 0;

    // --- All functions from createCandyObject to createBoard remain the same ---
    function createCandyObject(url, type = 'normal') { return { url, type }; }
    
    function playSound(sound) {
        sound.currentTime = 0; // Rewind to the start
        sound.play();
    }

    function initGame() {
        score = 0;
        moves = initialMoves;
        isProcessing = false;
        updateDisplay();
        createBoard();
        modal.classList.add('hidden');

        // --- NEW: Add global listeners for ending a swipe ---
        document.addEventListener('mouseup', candySelectEnd);
        document.addEventListener('touchend', candySelectEnd);
    }

    function createBoard() {
        board = [];
        for (let r = 0; r < boardSize; r++) {
            const rowArray = [];
            for (let c = 0; c < boardSize; c++) {
                let randomUrl;
                do {
                    randomUrl = allNormalCandies[Math.floor(Math.random() * allNormalCandies.length)];
                } while (
                    (c >= 2 && getNormalUrl(rowArray[c - 1].url) === randomUrl && getNormalUrl(rowArray[c - 2].url) === randomUrl) ||
                    (r >= 2 && getNormalUrl(board[r - 1][c].url) === randomUrl && getNormalUrl(board[r - 2][c].url) === randomUrl)
                );
                rowArray.push(createCandyObject(randomUrl));
            }
            board.push(rowArray);
        }
        renderBoard();
    }
    
    function getNormalUrl(url) {
        if (url === colorBombUrl) return null;
        for (const mapping of candyMappings) {
            if (Object.values(mapping).includes(url)) return mapping.normal;
        }
        return url;
    }

    // --- UPDATED: renderBoard function ---
    function renderBoard() {
        boardElement.innerHTML = '';
        for (let r = 0; r < boardSize; r++) {
            for (let c = 0; c < boardSize; c++) {
                const candy = board[r][c];
                const cell = document.createElement('div');
                cell.classList.add('candy-cell');
                cell.dataset.row = r;
                cell.dataset.col = c;
                
                if (candy) {
                    const candyImage = document.createElement('img');
                    candyImage.src = candy.url;
                    candyImage.setAttribute('draggable', false); // Important
                    cell.appendChild(candyImage);

                    if (candy.type !== 'normal') {
                        const normalUrl = getNormalUrl(candy.url);
                        const mapping = candyMappings.find(m => m.normal === normalUrl);
                        if (mapping && mapping.effects) {
                            mapping.effects.forEach(effect => cell.classList.add(`effect-${effect}`));
                        }
                        if (candy.type === 'bomb') cell.classList.add('effect-glow');
                    }
                }

                // --- REPLACED drag/drop with mousedown/touchstart listeners ---
                cell.addEventListener('mousedown', candySelectStart);
                cell.addEventListener('touchstart', candySelectStart, { passive: false });
                
                boardElement.appendChild(cell);
            }
        }
    }
    
    // --- NEW: Handle the start of a click or touch ---
    function candySelectStart(e) {
        if (isProcessing) return;
        
        // Prevent default behavior like image dragging
        e.preventDefault();
        
        selectedCandy = this; // 'this' refers to the candy-cell div
        const touch = e.touches ? e.touches[0] : e;
        startX = touch.clientX;
        startY = touch.clientY;
    }

    // --- NEW: Handle the end of a click/touch and determine the swipe ---
    async function candySelectEnd(e) {
        if (isProcessing || !selectedCandy) return;

        const touch = e.changedTouches ? e.changedTouches[0] : e;
        const endX = touch.clientX;
        const endY = touch.clientY;

        const deltaX = endX - startX;
        const deltaY = endY - startY;
        
        // We need a minimum swipe distance to avoid accidental taps
        const swipeThreshold = 20; 

        if (Math.abs(deltaX) < swipeThreshold && Math.abs(deltaY) < swipeThreshold) {
            selectedCandy = null; // It's a tap, not a swipe
            return;
        }

        // Determine the primary direction of the swipe
        let direction;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            direction = deltaX > 0 ? 'right' : 'left';
        } else {
            direction = deltaY > 0 ? 'down' : 'up';
        }

        const dRow = parseInt(selectedCandy.dataset.row);
        const dCol = parseInt(selectedCandy.dataset.col);

        let rRow = dRow;
        let rCol = dCol;

        // Calculate the coordinates of the target candy
        if (direction === 'right') rCol++;
        else if (direction === 'left') rCol--;
        else if (direction === 'up') rRow--;
        else if (direction === 'down') rRow++;

        // Check if the target is within the board boundaries
        if (rRow < 0 || rRow >= boardSize || rCol < 0 || rCol >= boardSize) {
            selectedCandy = null;
            return;
        }
        
        // --- This logic is repurposed from your old dragEnd function ---
        if (!musicStarted){
          bgMusic.play();
          musicStarted = true;
        }
        
        isProcessing = true;
        moves--;
        updateDisplay();
        await swapAndCheck(dRow, dCol, rRow, rCol);

        if (moves <= 0) setTimeout(gameOver, 500);
        
        selectedCandy = null; // Reset for the next turn
        isProcessing = false;
    }


    // --- All functions from swapAndCheck onwards remain the same ---
    async function swapAndCheck(r1, c1, r2, c2) {
        await swapCandies(r1, c1, r2, c2);
        const candy1 = board[r1][c1], candy2 = board[r2][c2];

        if (candy1.type === 'bomb' || candy2.type === 'bomb') {
            let bombPos = candy1.type === 'bomb' ? [r1,c1] : [r2,c2];
            let targetCandy = candy1.type === 'bomb' ? candy2 : candy1;
            let targetUrl = getNormalUrl(targetCandy.url);
            const toClear = new Set([`${bombPos[0]}-${bombPos[1]}`]);
            if (targetUrl) {
                for(let r=0; r<boardSize; r++) for(let c=0; c<boardSize; c++) {
                    if (board[r][c] && getNormalUrl(board[r][c].url) === targetUrl) toClear.add(`${r}-${c}`);
                }
            }
            await processMatches(Array.from(toClear).map(coord => coord.split('-').map(Number)));
        } else {
            const matchInfo = findMatches();
            if (matchInfo.allMatchedCoords.size > 0) {
                playSound(swapSound);
                await processMatches(Array.from(matchInfo.allMatchedCoords).map(c => c.split('-').map(Number)), matchInfo.specialMatches);
            } else {
                playSound(negativeSwapSound)
                await new Promise(r => setTimeout(r, 200));
                await swapCandies(r1, c1, r2, c2);
            }
        }
    }
    
    async function swapCandies(r1, c1, r2, c2) {
        [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];
        renderBoard();
        return new Promise(resolve => setTimeout(resolve, 200));
    }
    
    function findMatches() {
        const horizontalMatches = [], verticalMatches = [];
        for (let r = 0; r < boardSize; r++) {
            for (let c = 0; c < boardSize - 2; c++) {
                const candy1 = board[r][c];
                if (!candy1) continue;
                const normalUrl = getNormalUrl(candy1.url);
                if (!normalUrl) continue;
                let line = [{r,c}];
                for (let i = 1; c + i < boardSize; i++) {
                   const nextCandy = board[r][c+i];
                   if(nextCandy && getNormalUrl(nextCandy.url) === normalUrl) line.push({r, c:c+i});
                   else break;
                }
                if(line.length >= 3) {
                    horizontalMatches.push(line);
                    c += line.length - 1;
                }
            }
        }
         for (let c = 0; c < boardSize; c++) {
            for (let r = 0; r < boardSize - 2; r++) {
                const candy1 = board[r][c];
                if (!candy1) continue;
                const normalUrl = getNormalUrl(candy1.url);
                if (!normalUrl) continue;
                let line = [{r,c}];
                for (let i = 1; r + i < boardSize; i++) {
                   const nextCandy = board[r+i][c];
                   if(nextCandy && getNormalUrl(nextCandy.url) === normalUrl) line.push({r: r+i, c});
                   else break;
                }
                if(line.length >= 3) {
                    verticalMatches.push(line);
                    r += line.length - 1;
                }
            }
        }

        const allMatchedCoords = new Set();
        const specialMatches = [];
        const processedLines = new Set();
        for (const hLine of horizontalMatches) {
            for (const vLine of verticalMatches) {
                const hCoords = new Set(hLine.map(p => `${p.r}-${p.c}`));
                const vCoords = new Set(vLine.map(p => `${p.r}-${p.c}`));
                const intersection = [...hCoords].filter(coord => vCoords.has(coord));
                if (intersection.length > 0) {
                    processedLines.add(hLine).add(vLine);
                    [...hLine, ...vLine].forEach(p => allMatchedCoords.add(`${p.r}-${p.c}`));
                    specialMatches.push({
                        type: 'wrapped',
                        url: getNormalUrl(board[hLine[0].r][hLine[0].c].url),
                        placement: intersection[0].split('-').map(Number)
                    });
                }
            }
        }
        [...horizontalMatches, ...verticalMatches].forEach(line => {
            if (processedLines.has(line)) return;
            line.forEach(p => allMatchedCoords.add(`${p.r}-${p.c}`));
            if (line.length >= 4) {
                specialMatches.push({
                    type: line.length >= 5 ? 'bomb' : (line[0].r === line[1].r ? 'col' : 'row'),
                    url: getNormalUrl(board[line[0].r][line[0].c].url),
                    placement: [line[0].r, line[0].c]
                });
            }
        });
        return { allMatchedCoords, specialMatches };
    }

    async function processMatches(coords, specialMatches = []) {
        let toClear = new Set(coords.map(([r, c]) => `${r}-${c}`));
        for (const [r, c] of coords) {
            const candy = board[r][c];
            if (candy && candy.type !== 'normal') activateSpecial(r, c, candy.type, toClear);
        }
        playSound(swapSound);
        score += toClear.size * 10;
        updateDisplay();
        for (const coord of toClear) {
            const [r, c] = coord.split('-').map(Number);
            const cell = boardElement.querySelector(`[data-row='${r}'][data-col='${c}']`);
            if (cell) cell.classList.add('matched');
        }
        await new Promise(r => setTimeout(r, 300));

        for (const coord of toClear) {
            const [r, c] = coord.split('-').map(Number);
            board[r][c] = null;
        }
        
        if (specialMatches.length > 0) {
            for (const match of specialMatches) {
                 const [r,c] = match.placement;
                 if (board[r][c] !== null) continue; 
                 let newUrl, mapping;
                 switch(match.type) {
                     case 'bomb': newUrl = colorBombUrl; break;
                     case 'row': case 'col': case 'wrapped':
                         mapping = candyMappings.find(m => m.normal === match.url);
                         if (mapping) newUrl = mapping[match.type];
                         break;
                 }
                 if(newUrl) board[r][c] = createCandyObject(newUrl, match.type);
            }
        }
        
        await applyGravityAndRefill();
        const newMatchInfo = findMatches();
        if (newMatchInfo.allMatchedCoords.size > 0) {
            await processMatches(Array.from(newMatchInfo.allMatchedCoords).map(c => c.split('-').map(Number)), newMatchInfo.specialMatches);
        }
    }

    function activateSpecial(r, c, type, toClear) {
        if (type === 'row') for (let i = 0; i < boardSize; i++) if(board[r][i]) toClear.add(`${r}-${i}`);
        if (type === 'col') for (let i = 0; i < boardSize; i++) if(board[i][c]) toClear.add(`${i}-${c}`);
        if (type === 'wrapped') {
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize && board[nr][nc]) {
                    toClear.add(`${nr}-${nc}`);
                }
            }
        }
    }

    async function applyGravityAndRefill() {
        for (let c = 0; c < boardSize; c++) {
            let emptyRow = boardSize - 1;
            for (let r = boardSize - 1; r >= 0; r--) {
                if (board[r][c] !== null) {
                    if (r !== emptyRow) {
                        board[emptyRow][c] = board[r][c];
                        board[r][c] = null;
                    }
                    emptyRow--;
                }
            }
        }
        for (let c = 0; c < boardSize; c++) {
            for (let r = boardSize - 1; r >= 0; r--) {
                if (board[r][c] === null) {
                    board[r][c] = createCandyObject(allNormalCandies[Math.floor(Math.random() * allNormalCandies.length)]);
                }
            }
        }
        renderBoard(); 
        return new Promise(r => setTimeout(r, 300));
    }

    function gameOver() {
        isProcessing = true;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.getElementById('final-score').textContent = score;
        if (score > 1000) {
            modalTitle.textContent = "Amazing, Hero!";
        } else {
            modalTitle.textContent = "Great Try, Hero!";
        }
        restartButton.textContent = "Play Again!";
        bgMusic.pause();
    }

    function updateDisplay() {
        scoreElement.textContent = score;
        movesElement.textContent = moves;
    }

    document.getElementById('restart-button').addEventListener('click', initGame);
    initGame();
});

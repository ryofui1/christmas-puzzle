

// ✅ 問題定義クラス
class PuzzleProblem {
    constructor(name, width,height, items) {
        this.name = name;
        this.width = width;
        this.height=height;
        this.items = items; // [{color, pattern, shape}, ...]
        this.maxScore = 0; // 自動計算
    }
}

const shapeImgMap = {
    circle: 'images/circle.png',
    square: 'images/square.png',
    star: 'images/star.png',
    triangle: 'images/triangle.png',
    snowman: 'images/snowman.png',
    light: 'images/light.png'
};

// ✅ 問題セット管理クラス
class PuzzleSet {
    static problems = [
        new PuzzleProblem("基本問題 3x3", 3, 3, [
            { color: 'red', pattern: 'stripe', shape: 'circle' },
            { color: 'red', pattern: 'dot',    shape: 'star' },
            { color: 'red', pattern: 'none',  shape: 'square' }
        ]),
        new PuzzleProblem("中級 4x4", 4, 4, [
            {color: 'red', pattern: 'stripe', shape: 'square'},
            {color: 'red', pattern: 'none', shape: 'star'},
            {color: 'red', pattern: 'dot', shape: 'circle'},
            {color: 'red', pattern: 'dot', shape: 'circle'}
        ]),
        new PuzzleProblem("上級 5x5", 5, 5, [
            {color: 'red', pattern: 'stripe', shape: 'circle'},
            {color: 'blue', pattern: 'dot', shape: 'circle'},
            {color: 'blue', pattern: 'dot', shape: 'square'},
            {color: 'blue', pattern: 'none', shape: 'star'},
            {color: 'orange', pattern: 'dot', shape: 'circle'}
        ])
    ];
   
    static getProblem(index) {
        return this.problems[index % this.problems.length];
    }

    static getProblemCount(){
        return this.problems.length;
    }
}

const INVALID_MASKS = {
    3: new Set([0,2]),
    4: new Set([0,3,4,7]),
    5: new Set([0,1,3,4,5,9]),
};

class ColorPuzzle {
    static ATTRS = ['color', 'pattern', 'shape'];
    constructor(problemIndex = 0) {
        // ✅ 既存インスタンスがあれば終了
        // if (window.currentPuzzle) {
        //     console.warn('ColorPuzzleは既に初期化済みです');
        //     return;
        // }
       
        this.problemIndex = problemIndex;
        this.problem = PuzzleSet.getProblem(problemIndex);
        this.rows = this.problem.height;  // height使用
        this.cols = this.problem.width;   // width使用
        this.gridSize = this.rows * this.cols;
       
        console.log(`問題${this.problemIndex + 1}: ${this.rows}x${this.cols} = ${this.gridSize}`);
       
        this.grid = new Array(this.gridSize).fill(null);
        this.items = [...this.problem.items];
        this.colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
        this.score = 0;
        this.maxScore = 0;
        this.level = 1;
        this.draggedType = null;
        this.draggedIndex = -1;
        this.isMaxScoreFixed = false;
        this.disabledCells=INVALID_MASKS[this.cols];
        this.isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

        this.selectedItemIndex = null;
        this.selectedFromGridIndex = null;

        this.isClearPending = false;
       
        // ✅ グローバル登録
        window.currentPuzzle = this;
       
        this.init();
    }
   
    // ✅ グリッドサイズ→rows/cols変換テーブル
    getGridConfig(gridSize) {
        const configs = {
            9: {rows: 3, cols: 3},
            12: {rows: 4, cols: 3},
            15: {rows: 5, cols: 3},
            16: {rows: 4, cols: 4},
            20: {rows: 5, cols: 4},
            25: {rows: 5, cols: 5}
        };
        return configs[gridSize] || {rows: 3, cols: 3};
    }



    init() {
        const clearScreen = document.getElementById('clear-screen');
        if (clearScreen) {
            clearScreen.classList.add('hidden');
            clearScreen.classList.remove('show');
            clearScreen.hidden=true;
        }
        const clear = document.getElementById('clear-screen');
        const allClear = document.getElementById('all-clear-screen');

        if (clear) clear.hidden = true;
        if (allClear) allClear.hidden = true;
        document.querySelector('h1').textContent = `${this.problem.name}`;
        // document.getElementById('level-value').textContent = this.problemIndex + 1;

        this.maxScore = this.calculateMaxScore();
        // document.getElementById('max-score-value').textContent = this.maxScore;
        this.isMaxScoreFixed = true;

        // ★ ここが追加部分
        const restored = this.loadProgress();

        if (!restored) {
            this.grid = new Array(this.gridSize).fill(null);
            this.items = [...this.problem.items];
        }

        this.renderGrid();
        this.renderItems();
        this.attachEvents();
        this.updateScore();
    }


    saveProgress() {
        const data = {
            problemIndex: this.problemIndex,
            grid: this.grid,
            items: this.items
        };

        localStorage.setItem(
            'colorPuzzleSave',
            JSON.stringify(data)
        );
    }

    loadProgress() {
        const saved = localStorage.getItem('colorPuzzleSave');
        if (!saved) return false;

        let data;
        try {
            data = JSON.parse(saved);
        } catch {
            return false;
        }

        // 問題が違うなら復元しない
        if (data.problemIndex !== this.problemIndex) return false;

        // 構造チェック（安全装置）
        if (!Array.isArray(data.grid) || !Array.isArray(data.items)) {
            return false;
        }

        this.grid = data.grid;
        this.items = data.items;
        return true;
    }


    resetToInitial() {
        localStorage.removeItem('colorPuzzleSave');
        console.log(`問題${this.problemIndex + 1} リセット`);
        this.grid = new Array(this.gridSize).fill(null);
        this.items = [...this.problem.items];
        this.renderAllNoMaxRecalc();
    }


    generateItemsWithGuaranteedScore() {
        let attempts = 0;
        do {
            const itemCount = Math.floor(this.gridSize * 0.6) + Math.floor(Math.random() * 3);
            this.items = [];
            for (let i = 0; i < Math.min(itemCount, this.gridSize); i++) {
                this.items.push({
                    color: this.colors[Math.floor(Math.random() * this.colors.length)],
                    pattern: this.colors[Math.floor(Math.random() * this.colors.length)],
                    shape: this.colors[Math.floor(Math.random() * this.colors.length)]
                });
            }
            this.maxScore = this.calculateMaxScore();
            attempts++;
        } while (this.maxScore < 1 && attempts < 100);
    }


    getIndex(row, col) {
        return row * this.cols + col;
    }


    getRowCol(index) {
        return {
            row: Math.floor(index / this.cols),
            col: index % this.cols
        };
    }

    isDisabledCell(row, col) {
        const mask = INVALID_MASKS[this.rows];
        if (!mask) return false;
        return mask[row]?.[col] === 1;
    }

    countRun(grid, row, col, attr, value, dr, dc) {
        let len = 1;

        const check = (r, c) => {
            const item = grid[this.getIndex(r, c)];
            return item && item[attr] === value;
        };

        let r = row + dr, c = col + dc;
        while (r >= 0 && r < this.rows && c >= 0 && c < this.cols && check(r, c)) {
            len++; r += dr; c += dc;
        }

        r = row - dr; c = col - dc;
        while (r >= 0 && r < this.rows && c >= 0 && c < this.cols && check(r, c)) {
            len++; r -= dr; c -= dc;
        }

        return len;
    }


    getDeltaScore(grid, index, item) {
        const { row, col } = this.getRowCol(index);
        let delta = 0;
        grid[index] = item;

        ColorPuzzle.ATTRS.forEach(attr => {
            const value = item[attr];
            ColorPuzzle.DIRECTIONS.forEach(({ dr, dc }) => {
                const len = this.countRun(grid, row, col, attr, value, dr, dc);
                if (len >= 3) delta += (len - 2);
            });
        });

        grid[index] = null;
        return delta;
    }


    greedyPlacement() {
        const grid = Array(this.gridSize).fill(null);
        const items = [...this.items];
        let score = 0;


        while (items.length > 0) {
            let best = null;


            for (let i = 0; i < items.length; i++) {
                for (let pos = 0; pos < this.gridSize; pos++) {
                    if (grid[pos]) continue;


                    const delta = this.getDeltaScore(grid, pos, items[i]);
                    if (!best || delta > best.delta) {
                        best = { i, pos, delta };
                    }
                }
            }


            if (!best) break;


            const item = items.splice(best.i, 1)[0];
            grid[best.pos] = item;
            score += Math.max(0, best.delta);
        }


        return { grid, score };
    }



    localImprove(grid) {
        let improved = true;


        while (improved) {
            improved = false;
            const baseScore = this.calculateScoreForGrid(grid);


            for (let i = 0; i < this.gridSize; i++) {
                for (let j = i + 1; j < this.gridSize; j++) {
                    if (!grid[i] || !grid[j]) continue;


                    [grid[i], grid[j]] = [grid[j], grid[i]];


                    const newScore = this.calculateScoreForGrid(grid);
                    if (newScore > baseScore) {
                        improved = true;
                        return this.localImprove(grid); // 再スタート
                    }


                    [grid[i], grid[j]] = [grid[j], grid[i]];
                }
            }
        }
    }



    calculateMaxScore() {
        let bestScore = 0;
       
        // 貪欲配置を10回試行
        for (let t = 0; t < 10; t++) {
            const { grid, score } = this.greedyPlacement();
            this.localImprove(grid);
            const finalScore = this.calculateScoreForGrid(grid);
            bestScore = Math.max(bestScore, finalScore);
        }
       
        return bestScore;
    }


    greedyMaxScore(items) {
        let bestScore = 0;
        for (let t = 0; t < 10; t++) { // 試行回数削減
            const grid = Array(this.gridSize).fill(null);
            const shuffledItems = [...items].sort(() => Math.random() - 0.5);
           
            // ランダム配置
            const positions = [...Array(this.gridSize).keys()]
                .sort(() => Math.random() - 0.5)
                .slice(0, Math.min(shuffledItems.length, this.gridSize));
           
            positions.forEach((pos, i) => {
                grid[pos] = shuffledItems[i];
            });
           
            const score = this.calculateScoreForGrid(grid);
            bestScore = Math.max(bestScore, score);
        }
        return bestScore;
    }


    getCombinations(arr, k) {
        const result = [];
        const f = (prefix, rest, kLeft) => {
            if (kLeft === 0) {
                result.push([...prefix]);
                return;
            }
            for (let i = 0; i <= rest.length - kLeft; i++) {
                prefix.push(rest[i]);
                f(prefix, rest.slice(i + 1), kLeft - 1);
                prefix.pop();
            }
        };
        f([], arr, k);
        return result;
    }


    getPermutations(items) {
        if (items.length <= 1) return [items];
        const result = [];
        for (let i = 0; i < items.length; i++) {
            const rest = items.slice(0, i).concat(items.slice(i + 1));
            const subPerms = this.getPermutations(rest);
            subPerms.forEach(perm => result.push([items[i], ...perm]));
        }
        return result;
    }


    calculateScoreForGrid(grid) {
        let score = 0;

        const get = (r, c) => grid[this.getIndex(r, c)];

        ColorPuzzle.ATTRS.forEach(attr => {
            // 縦横斜めすべて同様にチェック
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const base = get(r, c);
                    if (!base) continue;

                    ColorPuzzle.DIRECTIONS.forEach(({ dr, dc }) => {
                        const r1 = r + dr, c1 = c + dc;
                        const r2 = r + dr * 2, c2 = c + dc * 2;

                        if (
                            r2 < this.rows && r2 >= 0 &&
                            c2 < this.cols && c2 >= 0
                        ) {
                            const a = get(r1, c1);
                            const b = get(r2, c2);
                            if (
                                a && b &&
                                base[attr] === a[attr] &&
                                base[attr] === b[attr]
                            ) {
                                score++;
                            }
                        }
                    });
                }
            }
        });

        return score;
    }



    checkClear() {
        if (this.score === this.maxScore && this.score > 0) {
            this.showClearScreen();
        }
    }

    showClearScreen() {
        const clear = document.getElementById('clear-screen');
        clear.classList.remove('hidden');
        clear.hidden = false;
    }



    renderPlayerSolutionImage() {
        const target = document.getElementById('tree-container'); 
        // ↑ tree + grid + ornaments を包んでいる要素

        console.log('capture target:', target);

        if (!target) {
            console.error('❌ play-area が見つかりません');
            return;
        }

        html2canvas(target, {
            backgroundColor: null,
            scale: 1,useCORS: true
        }).then(canvas => {
            // const resultCanvas = document.getElementById('completion-canvas');
            // const ctx = resultCanvas.getContext('2d');

            resultCanvas.width = canvas.width;
            resultCanvas.height = canvas.height;

            ctx.drawImage(canvas, 0, 0);
        });
    }


    scheduleClearCheck() {
        if (this.score !== this.maxScore || this.score === 0) return;
        if (this.isClearPending) return;

        this.isClearPending = true;

        const STAR_ANIMATION_TIME = 600;

        setTimeout(async () => {
            // ★ 先に画像を作る
            // await this.renderPlayerSolutionImage();

            // ★ その後で表示
            this.showClearScreen();

            this.isClearPending = false;
        }, STAR_ANIMATION_TIME);
    }




    downloadCompletion() {
        const canvas = document.getElementById('completion-canvas');
        const link = document.createElement('a');
        link.download = `パズル_${this.rows}x${this.cols}_問題${this.level}_私の解答_${this.score}点.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }


    nextLevel() {
        const clearScreen = document.getElementById('clear-screen');
        clearScreen.classList.remove('show');
        clearScreen.classList.add('hidden');
       
        this.level++;
        this.grid.fill(null);
        this.generateItemsWithGuaranteedScore();
        this.isMaxScoreFixed = false;
        this.renderAll();
        document.getElementById('level-value').textContent = this.level;
    }


    renderGrid() {
        const gridEl = document.getElementById('grid');
        gridEl.innerHTML = '';
        gridEl.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;

        this.grid.forEach((item, index) => {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.index = index;

            if (this.disabledCells.has(index)) {
                cell.classList.add('disabled');
                gridEl.appendChild(cell);
                return;
            }


            if (item) {
                cell.draggable = true;
                cell.innerHTML = `
                <div class="ornament color-${item.color} pattern-${item.pattern} shape-${item.shape}"></div>
                `;
            }

            if (this.isTouchDevice) {
                cell.addEventListener('click', () => {
                    this.handleCellTap(index);
                });
            }

            gridEl.appendChild(cell);
        });
    }

    updateSelectionUI() {
        document.querySelectorAll('.item').forEach(el => {
            el.classList.toggle(
                'selected',
                Number(el.dataset.itemIndex) === this.selectedItemIndex
            );
        });

        document.querySelectorAll('.cell').forEach(el => {
            el.classList.toggle(
                'selected',
                Number(el.dataset.index) === this.selectedFromGridIndex
            );
        });
    }


    selectItemFromBar(index) {
        this.selectedItemIndex = index;
        this.selectedFromGridIndex = null;
        this.updateSelectionUI();
    }

    handleDragStartFromBar(e) {
        const index = Number(e.currentTarget.dataset.itemIndex);
        this.draggedType = 'bar';
        this.draggedIndex = index;
    }

    renderItems() {
        const itemsEl = document.getElementById('items');
        itemsEl.innerHTML = '';

        this.items.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = 'item';
            el.dataset.itemIndex = index;
            el.draggable = true;
            el.innerHTML = `
                <div class="ornament color-${item.color} pattern-${item.pattern} shape-${item.shape}"></div>
            `;
            // <div class="ornament color-red pattern-dot shape-star"></div>

            if (this.isTouchDevice) {
                el.addEventListener('click', () => {
                    this.selectItemFromBar(index);
                });
            } else {
                el.draggable = true;
                el.addEventListener('dragstart', e => this.handleDragStartFromBar(e));
            }

            itemsEl.appendChild(el);
        });
    }



attachEvents() {
    // ✅ グリッドイベント
    document.querySelectorAll('.cell').forEach(cell => {
        cell.addEventListener('dragstart', (e) => {
            const cellEl = e.target.closest('.cell');
            if (!cellEl || cellEl.classList.contains('empty')) {
                e.preventDefault();
                return;
            }

            this.draggedType = 'grid';
            this.draggedIndex = Number(cellEl.dataset.index);
            cellEl.style.opacity = '0.5';
        });
        cell.addEventListener('dragend', (e) => {
            if (this.draggedType === 'grid') e.target.style.opacity = '1';
        });
        cell.addEventListener('dragover', (e) => e.preventDefault());
        cell.addEventListener('drop', (e) => this.handleDrop(e));
    });


    // ✅ アイテムイベント
    document.querySelectorAll('.item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            const itemEl = e.target.closest('.item');
            if (!itemEl) {
                e.preventDefault();
                return;
            }

            this.draggedType = 'item';
            this.draggedIndex = Number(itemEl.dataset.itemIndex);
            itemEl.style.opacity = '0.5';
        });
        item.addEventListener('dragend', (e) => {
            if (this.draggedType === 'item') e.target.style.opacity = '1';
        });
    });


    // ✅ アイテムバーイベント
    const itemBar = document.getElementById('item-bar');
    itemBar.addEventListener('dragover', (e) => e.preventDefault());
    itemBar.addEventListener('drop', (e) => this.handleDrop(e));


    // ✅ リセットボタン
        const resetBtn = document.getElementById('reset');
        if (resetBtn) resetBtn.onclick = () => this.resetToInitial();


        // ✅ クリア画面ボタン（事前登録）
        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) nextBtn.onclick = () => this.nextProblem();
}



    handleDrop(e) {
        
        e.preventDefault();
        const index = Number(e.currentTarget.dataset.index);
        if (this.disabledCells.has(index)) return;
        if (
            this.draggedIndex === -1 ||
            Number.isNaN(this.draggedIndex) ||
            !this.draggedType
        ) {
            this.resetDrag();
            return;
        }


        const targetCell = e.target.closest('.cell');
        const isItemBarDrop = e.target.closest('#item-bar') && !targetCell;

        if (this.draggedType === 'item' && targetCell) {
            const targetIndex = parseInt(targetCell.dataset.index);
            if (this.grid[targetIndex] === null) {
                this.grid[targetIndex] = this.items[this.draggedIndex];
                this.items.splice(this.draggedIndex, 1);
            } else {
                const temp = this.items[this.draggedIndex];
                this.items[this.draggedIndex] = this.grid[targetIndex];
                this.grid[targetIndex] = temp;
            }
            this.resetDrag();
            this.renderAllNoMaxRecalc();
            return;
        }
       
        if (this.draggedType === 'grid' && targetCell) {
            const targetIndex = parseInt(e.currentTarget.dataset.index);

            if (this.grid[targetIndex] === null) {
                [this.grid[this.draggedIndex], this.grid[targetIndex]] =
                [this.grid[targetIndex], this.grid[this.draggedIndex]];
            } else if (this.draggedIndex !== targetIndex) {
                [this.grid[this.draggedIndex], this.grid[targetIndex]] =
                [this.grid[targetIndex], this.grid[this.draggedIndex]];
            }
            this.resetDrag();
            this.renderAllNoMaxRecalc();
            return;
        }
       
        if (this.draggedType === 'grid' && isItemBarDrop) {
            this.items.push(this.grid[this.draggedIndex]);
            this.grid[this.draggedIndex] = null;
            this.resetDrag();
            this.renderAllNoMaxRecalc();
            return;
        }
    }

    handleCellTap(index) {
        // 無効セルは無視
        if (this.disabledCells.has(index)) return;

        // バーから選択されている場合 → 設置
        if (this.selectedItemIndex !== null) {
            if (this.grid[index] !== null) return;

            this.grid[index] = this.items[this.selectedItemIndex];
            this.items.splice(this.selectedItemIndex, 1);

            this.selectedItemIndex = null;
            this.renderAll();
            return;
        }

        // グリッド上の飾りを選択
        if (this.grid[index]) {
            this.selectedFromGridIndex = index;
            this.selectedItemIndex = null;
            this.updateSelectionUI();
            return;
        }

        // グリッド → グリッドの移動
        if (this.selectedFromGridIndex !== null && this.grid[index] === null) {
            this.grid[index] = this.grid[this.selectedFromGridIndex];
            this.grid[this.selectedFromGridIndex] = null;

            this.selectedFromGridIndex = null;
            this.renderAll();
        }
    }



    renderAllNoMaxRecalc() {
        this.renderGrid();
        this.renderItems();
        this.attachEvents();
        this.updateScore(); // 得点のみ更新、最大得点は固定
        this.saveProgress();
    }



    renderAll() {
        this.renderGrid();
        this.renderItems();
        this.attachEvents();
        this.updateScore();
        this.updateMaxScore();
    }


    resetDrag() {
        this.draggedType = null;
        this.draggedIndex = -1;
    }


    calculateProblemMaxScore() {
        // 問題固有の最大得点を事前計算（1回のみ）
        this.problem.maxScore = this.calculateMaxScoreForItems(this.items);
    }


    calculateMaxScoreForItems(items) {
        // 既存の貪欲法/ローカルサーチを使用
        let bestScore = 0;
        for (let t = 0; t < 20; t++) {
            const { grid, score } = this.greedyPlacement(items);
            this.localImprove(grid);
            const finalScore = this.calculateScoreForGrid(grid);
            bestScore = Math.max(bestScore, finalScore);
        }
        return bestScore;
    }


    nextProblem() {
        localStorage.removeItem('colorPuzzleSave');
        console.log(`問題${this.problemIndex + 1} → 問題${this.problemIndex + 2}`);
        
        // ✅ 全問題クリア判定
        if (this.problemIndex === PuzzleSet.getProblemCount() - 1) {  // 問題3クリア時
            this.showAllClearScreen();
            return;
        }
        
        // ✅ 通常の次の問題
        window.currentPuzzle = null;  // 既存インスタンス破棄
        
        const clearScreen = document.getElementById('clear-screen');
        clearScreen.classList.remove('show');
        clearScreen.classList.add('hidden');
        
        document.getElementById('grid').innerHTML = '';
        document.getElementById('items').innerHTML = '';
        
        setTimeout(() => {
            new ColorPuzzle((this.problemIndex + 1) % 3);
        }, 100);
        // this.updateMaxScore();
        document.getElementById('clear-screen').classList.add('hidden');
    }

    // ✅ 新規追加: 全クリア画面
    showAllClearScreen() {
        console.log("clear");
        const screen = document.getElementById('all-clear-screen');
        if (!screen) {
            console.warn('all-clear-screen が見つかりません');
            return;
        }

        screen.hidden = false;
    }


    // ✅ 新規追加: 最初からリスタート
    restartFromBeginning() {
        window.currentPuzzle = null;
        
        const clearScreen = document.getElementById('clear-screen');
        clearScreen.classList.remove('show');
        clearScreen.classList.add('hidden');
        
        // ボタン文言リセット
        document.getElementById('download-btn').textContent = '解答ダウンロード';
        document.getElementById('next-level-btn').textContent = '次の問題';
        
        // 問題1へ完全リスタート
        document.getElementById('grid').innerHTML = '';
        document.getElementById('items').innerHTML = '';
        new ColorPuzzle(0);
    }

    // ✅ 新規追加: 全クリアお祝い画像
    renderAllClearImage() {
        const canvas = document.getElementById('completion-canvas');
        const ctx = canvas.getContext('2d');
        
        // 背景グラデーション
        const gradient = ctx.createLinearGradient(0, 0, 400, 400);
        gradient.addColorScolor(0, '#FFD700');
        gradient.addColorScolor(1, '#FFA500');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 400, 400);
        
        // ⭐全クリア⭐
        ctx.fillStyle = '#FF6B6B';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'patterndle';
        ctx.fillText('⭐ 全クリア ⭐', 200, 180);
        
        ctx.fillStyle = '#333';
        ctx.font = 'bold 24px Arial';
        ctx.fillText('全3問完璧クリア！', 200, 230);
        
        // メダル
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(200, 120, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#DAA520';
        ctx.lineWidth = 4;
        ctx.stroke();
    }


    shuffle() {
        console.log('シャッフル実行');
       
        // ✅ グリッドクリアのみ、問題アイテムはそのままシャッフル
        this.grid.fill(null);
        this.items = [...this.problem.items].sort(() => Math.random() - 0.5);
       
        // ✅ 最大得点再計算せず（問題固有）
        this.isMaxScoreFixed = true;
       
        this.renderAllNoMaxRecalc();
    }


    updateStarScore(score, maxScore) {
        const el = document.getElementById('star-score');

        // 前回スコアを保持
        const prevScore = this.prevScore ?? 0;
        this.prevScore = score;

        el.innerHTML = '';

        for (let i = 0; i < maxScore; i++) {
            const span = document.createElement('span');
            span.classList.add('star');

            if (i < score) {
                span.textContent = '★';
                span.classList.add('filled');

                // ★が「新しく増えた」場合だけ
                if (i >= prevScore) {
                    span.classList.add('pop');
                }
            } else {
                span.textContent = '☆';
            }

            el.appendChild(span);
        }
    }


    updateScore() {
        const score = this.calculateScoreForGrid(this.grid);
        this.score = score;
        // document.getElementById("score-value").textContent = score;
        console.log(this.grid);
        console.log(this.calculateScoreForGrid(this.grid));
        this.scheduleClearCheck();


        // const score = this.calculateScoreForGrid(this.grid);
        const max = this.maxScore;
        this.updateStarScore(score, max);

    }


    updateMaxScore() {
        // ✅ 問題データ時は常に表示済みのmaxScoreを使用
        // if (this.maxScore > 0) {
        //     document.getElementById('max-score-value').textContent = this.maxScore;
        // }
        
    }


    calculateScore() {
        return this.calculateScoreForGrid(this.grid);
    }
}


ColorPuzzle.DIRECTIONS = [
    { dr: 1, dc: 0 },
    { dr: 0, dc: 1 },
    { dr: 1, dc: 1 },
    { dr: 1, dc: -1 }
];



const saved = localStorage.getItem('colorPuzzleSave');

if (saved) {
    try {
        const data = JSON.parse(saved);
        new ColorPuzzle(data.problemIndex);
    } catch {
        new ColorPuzzle(0);
    }
} else {
    new ColorPuzzle(0);
}


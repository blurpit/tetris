import { TetriminoShape } from "./game";
import { Vec2 } from "./main";

/** Color type of the form `"rgb(r, g, b)"` */
type RGB = `rgb(${number}, ${number}, ${number})`;
/** Color type of the form `"rgb(r, g, b, a)"` */
type RGBA = `rgb(${number}, ${number}, ${number}, ${number})`;
/** Color type of the form `"#ffffff"` */
type HEX = `#${string}`;

/** Block CSS colors */
export enum BlockColor {
    Yellow    = "#ffe600", // O-Tetrimino
    LightBlue = "#00a2ff", // I-Tetrimino
    Purple    = "#aa00ff", // T-Tetrimino
    Orange    = "#ff8400", // L-Tetrimino
    DarkBlue  = "#1d00db", // J-Tetrimino
    Green     = "#00db00", // S-Tetrimino
    Red       = "#e30000", // Z-Tetrimino
    Gray      = "#696969",
    Ghost     = "#0002",
}

/** Union color type, including `RGB`, `RGBA`, `HEX`, and `BlockColor` */
export type Color = RGB | RGBA | HEX | BlockColor;

/** Mapping of `TetriminoShape` to `BlockColor` */
export const TetriminoColors = [
    BlockColor.Yellow,    // O
    BlockColor.LightBlue, // I
    BlockColor.Purple,    // T
    BlockColor.Orange,    // L
    BlockColor.DarkBlue,  // J
    BlockColor.Green,     // S
    BlockColor.Red,       // Z
    BlockColor.Gray,
    BlockColor.Ghost,
]

/** Graphics config */
export type GraphicsConfig = {
    // Game properties
    /** Canvas element to draw to */
    canvas: HTMLCanvasElement,
    /** Width of the Matrix in blocks */
    matrixWidth: number,
    /** Height of the Matrix in blocks */
    matrixHeight: number,
    /** Width/height of the Next/Held Tetrimino preview window in blocks */
    uiPreviewSize: number

    // Game styling
    /** Show Ghost Piece */
    showGhost: boolean,
    /** Background color */
    bgColor: Color,
    /** Background color of the main game area */
    matrixBgColor: Color,
    /** Stroke color of the main game area */
    matrixStrokeColor: Color,
    /** Color of the grid lines */
    gridColor: Color,
    /** Padding in pixels between the Matrix area and the edge of the canvas */
    matrixPadding: number,
    /** Weight of the stroke around Blocks */
    blockStrokeWidth: number,
    /** Font family for text */
    fontFamily: string,
    /** Font size */
    fontSize: number,
    /** Font size for bigger text, like score numbers */
    bigFontSize: number,
    /** Padding in pixels between UI text, like score and level */
    textPadding: number,
    /** Color of the background when paused / game over */
    pauseOverlayColor: Color,
}

/** Class for drawing Tetris graphics */
export class Graphics {
    public cfg: GraphicsConfig;
    
    /** Canvas reference */
    private canvas: HTMLCanvasElement;
    /** Canvas 2d context */
    private context: CanvasRenderingContext2D;
    /** True if a frame is queued to draw */
    private queueFrame: boolean = false;
    
    /** Matrix of colors to draw */
    private colorMatrix: (BlockColor | null)[][];

    /** Shape of the next Tetrimino */
    private nextTetrimino: TetriminoShape;
    /** Mino positions of the next Tetrimino */
    private nextMinos: Vec2[];
    /** Shape of the held Tetrimino */
    private heldTetrimino: TetriminoShape | null;
    /** Mino positions of the held Tetrimino */
    private heldMinos: Vec2[] | null;
    /** Current score */
    private score: number;
    /** Current level */
    private level: number;
    /** Current high score */
    private highScore: number;
    /** Current y value for drawing UI elements */
    private uiY;

    /** Whether the game is paused */
    public isPaused;

    constructor(config: GraphicsConfig) {
        this.cfg = config;

        let context = config.canvas.getContext("2d");
        if (context === null) throw "Game canvas context is null!";
        this.canvas = config.canvas;
        this.context = context;

        // Create color matrix
        this.colorMatrix = [];
        for (let y = 0; y < this.cfg.matrixHeight; y++) {
            let row = [];
            for (let x = 0; x < this.cfg.matrixWidth; x++) {
                row.push(null);
            }
            this.colorMatrix.push(row);
        }

        this.nextMinos = [];
        this.nextTetrimino = TetriminoShape.O;
        this.heldMinos = null;
        this.heldTetrimino = null;
        this.score = 0;
        this.level = 1;
        this.highScore = 0;
        this.uiY = 0;

        this.isPaused = false;
    }

    /** Reset game */
    public reset() {
        for (let y = 0; y < this.cfg.matrixHeight; y++) {
            for (let x = 0; x < this.cfg.matrixWidth; x++) {
                this.colorMatrix[y][x] = null;
            }
        }
        this.nextMinos = [];
        this.nextTetrimino = TetriminoShape.O;
        this.heldMinos = null;
        this.heldTetrimino = null;
        this.score = 0;
        this.level = 1;

        this.isPaused = false;
    }

    /** Queue a frame to draw */
    public draw() {
        if (!this.queueFrame) {
            requestAnimationFrame(this.drawFrame.bind(this));
            this.queueFrame = true;
        }
    }

    /** Draw a frame */
    private drawFrame() {
        this.context.fillStyle = this.cfg.bgColor;
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.uiY = 0;
        this.drawGrid();
        this.drawBlocks();
        this.drawNextTetrimino();
        this.drawScore();
        this.drawLevel();
        this.drawHighScore();
        this.drawHeldTetrimino();
        if (this.isPaused) this.drawPauseScreen();
        
        this.queueFrame = false;
    }

    /** Draw grid lines on the Matrix */
    public drawGrid() {
        let width = this.cfg.matrixWidth;
        let height = this.cfg.matrixHeight;
        let ctx = this.context;
        let size = this.getBlockSize();
        let [matX, matY] = this.getMatrixPos(size);

        // Matrix border & background color
        ctx.beginPath();
        ctx.rect(matX, matY, width * size, height * size);
        ctx.fillStyle = this.cfg.matrixBgColor;
        ctx.fill();
        ctx.lineWidth = this.cfg.blockStrokeWidth;
        ctx.strokeStyle = "black";
        ctx.stroke();

        // Vertical gridlines
        for (let x = 1; x < width; x++) {
            ctx.moveTo(x * size + matX, matY);
            ctx.lineTo(x * size + matX, height * size + matY);
        }

        // Horizontal gridlines
        for (let y = 1; y < height; y++) {
            ctx.moveTo(matX, y * size + matY);
            ctx.lineTo(width * size + matX, y * size + matY);
        }

        ctx.strokeStyle = this.cfg.gridColor;
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    /**
     * Set a Tetrimino in the color matrix
     * @param x x position of the center Mino
     * @param y y position of the center Mino
     * @param minos Array of positions of each Mino in the Tetrimino, relative to the center Mino
     * @param shape Tetrimino shape
     */
    public setTetrimino(x: number, y: number, minos: Vec2[], shape: TetriminoShape) {
        for (let mino of minos) {
            this.setBlock(x + mino[0], y + mino[1], shape);
        }
    }

    /**
     * Set the Next Tetrimino display
     * @param minos Array of positions of each Mino in the Tetrimino, relative to the center Mino
     * @param shape Tetrimino shape
     */
    public setNextTetrimino(minos: Vec2[], shape: TetriminoShape) {
        this.nextMinos = minos;
        this.nextTetrimino = shape;
    }

    /**
     * Set the Held Tetrimino display
     * @param minos Array of positions of each Mino in the Tetrimino, relative to the center Mino
     * @param shape Tetrimino shape
     */
    public setHeldTetrimino(minos: Vec2[] | null, shape: TetriminoShape | null) {
        this.heldMinos = minos;
        this.heldTetrimino = shape;
    }

    /** Set the score display */
    public setScore(score: number) {
        this.score = score;
    }

    /** Set the level display */
    public setLevel(level: number) {
        this.level = level;
    }

    /** Set the high score display */
    public setHighScore(highScore: number) {
        this.highScore = highScore;
    }

    /** Show or hide the pause screen */
    public togglePaused() {
        this.isPaused = !this.isPaused;
    }

    /**
     * Set a Block color in the color matrix
     * @param x x position of the Block
     * @param y y position of the Block
     * @param shape Tetrimino shape (determines color)
     */
    public setBlock(x: number, y: number, shape: TetriminoShape) {
        let width = this.cfg.matrixWidth;
        let height = this.cfg.matrixHeight;
        let color = TetriminoColors[shape];
        if (x >= 0 && x < width && y >= 0 && y < height) {
            this.colorMatrix[y][x] = color;
        }
    }

    /** Clear a block in the color matrix */
    public clearBlock(x: number, y: number) {
        this.colorMatrix[y][x] = null;
    }

    public drawBlocks() {
        let width = this.cfg.matrixWidth;
        let height = this.cfg.matrixHeight;
        let size = this.getBlockSize();
        let [matX, matY] = this.getMatrixPos(size);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let color = this.colorMatrix[y][x];
                if (color !== null) {
                    this.drawBlock(
                        matX + x * size, 
                        matY + (height - y - 1) * size, 
                        size, color
                    );
                }
            }
        }
    }

    /**
     * Draw a single block to the canvas
     * @param x x position (in pixels, canvas coords) of the block
     * @param y y posiiton (in pixels, canvas coords) of the block
     * @param size Width/height of the block in pixels
     * @param color Block color
     */
    private drawBlock(x: number, y: number, size: number, color: BlockColor) {
        let ctx = this.context;
        let strokeWidth = this.cfg.blockStrokeWidth;

        ctx.beginPath();
        ctx.rect(Math.floor(x), Math.floor(y), size, size);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = "black";
        ctx.stroke();
    }

    /** Draw the Next Tetrimino and "next" text to the canvas */
    private drawNextTetrimino() {
        let width = this.cfg.uiPreviewSize;
        let size = this.getBlockSize();
        let [matX, matY] = this.getMatrixPos(size);
        let ctx = this.context;
        
        let x = matX + size * this.cfg.matrixWidth + this.cfg.matrixPadding;
        let y = matY;
        size = this.cfg.fontSize / 2;

        // Write text
        ctx.fillStyle = "black";
        ctx.textAlign = "left";
        ctx.font = `${this.cfg.fontSize}px ${this.cfg.fontFamily}`;
        ctx.fillText("next", x, y + this.cfg.fontSize);
        y += this.cfg.fontSize + this.cfg.textPadding;

        // Matrix border & background color
        ctx.beginPath();
        ctx.rect(x, y, width * size, width * size);
        ctx.fillStyle = this.cfg.matrixBgColor;
        ctx.fill();
        ctx.lineWidth = this.cfg.blockStrokeWidth;
        ctx.strokeStyle = "black";
        ctx.stroke();

        // Find bounding box of the tetrimino
        let [minX, maxX, minY, maxY] = this.getTetriminoBounds(this.nextMinos);
        let tetrWidth = (maxX - minX + 1) * size;
        let tetrHeight = (maxY - minY + 1) * size;

        // Draw tetrimino
        for (let mino of this.nextMinos) {
            this.drawBlock(
                x + (width * size)/2 + (mino[0] - minX) * size - tetrWidth/2,
                y + (width * size)/2 + (maxY - mino[1] - minY) * size - tetrHeight/2,
                size, TetriminoColors[this.nextTetrimino]
            );
        }
        y += size * width;

        this.uiY = y + this.cfg.textPadding;
    }

    /** Draw the score text to the canvas */
    private drawScore() {
        let size = this.getBlockSize();
        let [matX, _] = this.getMatrixPos(size);
        let ctx = this.context;

        let x = matX + size * this.cfg.matrixWidth + this.cfg.matrixPadding;
        let y = this.uiY;

        // Write label
        ctx.fillStyle = "black";
        ctx.textAlign = "left";
        ctx.font = `${this.cfg.fontSize}px ${this.cfg.fontFamily}`;
        ctx.fillText("score", x, y + this.cfg.fontSize);
        y += this.cfg.fontSize;

        // Write score
        ctx.font = `${this.cfg.bigFontSize}px ${this.cfg.fontFamily}`;
        ctx.fillText(this.score.toString(), x, y + this.cfg.bigFontSize);
        y += this.cfg.bigFontSize;

        this.uiY = y + this.cfg.textPadding;
    }

    /** Draw the level text to the canvas */
    private drawLevel() {
        let size = this.getBlockSize();
        let [matX, _] = this.getMatrixPos(size);
        let ctx = this.context;

        let x = matX + size * this.cfg.matrixWidth + this.cfg.matrixPadding;
        let y = this.uiY;

        // Write label
        ctx.fillStyle = "black";
        ctx.textAlign = "left";
        ctx.font = `${this.cfg.fontSize}px ${this.cfg.fontFamily}`;
        ctx.fillText("level", x, y + this.cfg.fontSize);
        y += this.cfg.fontSize;

        // Write level
        ctx.font = `${this.cfg.bigFontSize}px ${this.cfg.fontFamily}`;
        ctx.fillText(this.level.toString(), x, y + this.cfg.bigFontSize);
        y += this.cfg.bigFontSize;

        this.uiY = y + this.cfg.textPadding;
    }

    /** Draw the high score text to the canvas */
    private drawHighScore() {
        let size = this.getBlockSize();
        let [matX, _] = this.getMatrixPos();
        let ctx = this.context;

        let x = matX + size * this.cfg.matrixWidth + this.cfg.matrixPadding;
        let y = this.uiY + this.cfg.textPadding * 4;

        // Write label
        ctx.fillStyle = "black";
        ctx.textAlign = "left";
        ctx.font = `${this.cfg.fontSize}px ${this.cfg.fontFamily}`;
        ctx.fillText("high score", x, y + this.cfg.fontSize);
        y += this.cfg.fontSize;

        // Write high score
        ctx.font = `${this.cfg.bigFontSize}px ${this.cfg.fontFamily}`;
        ctx.fillText(this.highScore.toString(), x, y + this.cfg.bigFontSize);
        y += this.cfg.bigFontSize;

        this.uiY = y + this.cfg.textPadding;
    }

    /** Draw the Held Tetrimino and "hold" text to the canvas */
    private drawHeldTetrimino() {
        let size = this.cfg.fontSize / 2;
        let width = this.cfg.uiPreviewSize;
        let [matX, matY] = this.getMatrixPos();
        let ctx = this.context;
        
        let x = matX - this.cfg.matrixPadding - size * width;
        let y = matY;

        // Write text
        ctx.fillStyle = "black";
        ctx.textAlign = "left";
        ctx.font = `${this.cfg.fontSize}px ${this.cfg.fontFamily}`;
        ctx.fillText("hold", x, y + this.cfg.fontSize);
        y += this.cfg.fontSize + this.cfg.textPadding;

        // Matrix border & background color
        ctx.beginPath();
        ctx.rect(x, y, width * size, width * size);
        ctx.fillStyle = this.cfg.matrixBgColor;
        ctx.fill();
        ctx.lineWidth = this.cfg.blockStrokeWidth;
        ctx.strokeStyle = "black";
        ctx.stroke();

        if (this.heldTetrimino !== null && this.heldMinos !== null) {
            // Find bounding box of the tetrimino
            let [minX, maxX, minY, maxY] = this.getTetriminoBounds(this.heldMinos);
            let tetrWidth = (maxX - minX + 1) * size;
            let tetrHeight = (maxY - minY + 1) * size;

            // Draw tetrimino
            for (let mino of this.heldMinos) {
                this.drawBlock(
                    x + (width * size)/2 + (mino[0] - minX) * size - tetrWidth/2,
                    y + (width * size)/2 + (maxY - mino[1] - minY) * size - tetrHeight/2,
                    size, TetriminoColors[this.heldTetrimino]
                );
            }
        }
    }

    /** Draw the paused screen */
    private drawPauseScreen() {
        let ctx = this.context;

        ctx.fillStyle = this.cfg.pauseOverlayColor;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Write text
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.font = `${this.cfg.bigFontSize}px ${this.cfg.fontFamily}`;
        ctx.fillText("paused", this.canvas.width/2, this.canvas.height/2);
    }

    /**
     * Get the position of the main game area in canvas coordinates
     * @param blockSize Width/height of Blocks in pixels
     * @returns Position in pixels of the Matrix
     */
    private getMatrixPos(blockSize?: number): Vec2 {
        if (blockSize === undefined) 
            blockSize = this.getBlockSize();

        let matWidth = blockSize * this.cfg.matrixWidth;
        let matHeight = blockSize * this.cfg.matrixHeight;

        return [
            this.canvas.width/2 - matWidth/2,
            this.canvas.height/2 - matHeight/2
        ];
    }

    /**
     * Calculate the size of Blocks based on the size of the canvas
     * @returns Width/height of Blocks in pixels
     */
    private getBlockSize(): number {
        let a = (this.canvas.width - this.cfg.matrixPadding*2) 
                / this.cfg.matrixWidth;
        let b = (this.canvas.height - this.cfg.matrixPadding*2) 
                / this.cfg.matrixHeight;
        return Math.min(a, b);
    }

    /**
     * Get the bounding box of a Tetrimino
     * @param minos Array of positions of each Mino in the Tetrimino, relative to the center Mino
     * @returns [minX, maxX, minY, maxY]
     */
    private getTetriminoBounds(minos: Vec2[]) {
        let minX = 999;
        let maxX = -999;
        let minY = 999;
        let maxY = -999;
        for (let mino of minos) {
            minX = Math.min(minX, mino[0]);
            maxX = Math.max(maxX, mino[0]);
            minY = Math.min(minY, mino[1]);
            maxY = Math.max(maxY, mino[1]);
        }
        return [minX, maxX, minY, maxY];
    }
}

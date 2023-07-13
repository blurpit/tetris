import { TetriminoShape } from "./game";
import { Vec2 } from "./main";

type RGB = `rgb(${number}, ${number}, ${number})`;
type RGBA = `rgb(${number}, ${number}, ${number}, ${number})`;
type HEX = `#${string}`;

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

export type Color = RGB | RGBA | HEX | BlockColor;

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

export type GraphicsConfig = {
    // Game properties
    canvas: HTMLCanvasElement,
    matrixWidth: number,
    matrixHeight: number,
    nextPreviewSize: number

    // Game styling
    showGhost: boolean,
    bgColor: Color,
    matrixBgColor: Color,
    matrixStrokeColor: Color,
    gridColor: Color,
    matrixPadding: number,
    blockStrokeWidth: number,
    fontFamily: string,
    fontSize: number,
    bigFontSize: number,
    textPadding: number,
}

export class Graphics {
    public cfg: GraphicsConfig;
    
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private queueFrame: boolean = false;
    
    private colorMatrix: (BlockColor | null)[][];

    // Ui info
    private nextTetrimino: TetriminoShape;
    private nextMinos: Vec2[];
    private score: number;
    private level: number;

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
        this.score = 0;
        this.level = 1;
    }

    public reset() {
        for (let y = 0; y < this.cfg.matrixHeight; y++) {
            for (let x = 0; x < this.cfg.matrixWidth; x++) {
                this.colorMatrix[y][x] = null;
            }
        }
        this.nextMinos = [];
        this.nextTetrimino = TetriminoShape.O;
        this.score = 0;
        this.level = 1;
    }

    public draw() {
        if (!this.queueFrame) {
            requestAnimationFrame(this.drawFrame.bind(this));
            this.queueFrame = true;
        }
    }

    private drawFrame() {
        this.context.fillStyle = this.cfg.bgColor;
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawGrid();
        this.drawBlocks();
        this.drawNextTetrimino();
        this.drawScore();
        this.drawLevel();
        
        this.queueFrame = false;
    }

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

    public setTetrimino(x: number, y: number, minos: Vec2[], shape: TetriminoShape) {
        for (let mino of minos) {
            this.setBlock(x + mino[0], y + mino[1], shape);
        }
    }

    public setNextTetrimino(minos: Vec2[], shape: TetriminoShape) {
        this.nextMinos = minos;
        this.nextTetrimino = shape;
    }

    public setScore(score: number) {
        this.score = score;
    }

    public setLevel(level: number) {
        this.level = level;
    }

    public setBlock(x: number, y: number, shape: TetriminoShape) {
        let width = this.cfg.matrixWidth;
        let height = this.cfg.matrixHeight;
        let color = TetriminoColors[shape];
        if (x >= 0 && x < width && y >= 0 && y < height) {
            this.colorMatrix[y][x] = color;
        }
    }

    public clearBlock(x: number, y: number) {
        this.colorMatrix[y][x] = null;
    }

    public clearLine(y: number) {
        let lineY = y;
        let width = this.cfg.matrixWidth;
        let height = this.cfg.matrixHeight;

        for (let y = lineY; y < height-1; y++) {
            for (let x = 0; x < width; x++) {
                this.colorMatrix[y][x] = this.colorMatrix[y+1][x];
            }
        }
        for (let x = 0; x < width; x++) {
            this.colorMatrix[height-1][x] = null;
        }
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

    private drawNextTetrimino() {
        let width = this.cfg.nextPreviewSize;
        let size = this.getBlockSize();
        let [matX, matY] = this.getMatrixPos(size);
        let ctx = this.context;

        let x = matX + size * this.cfg.matrixWidth + this.cfg.matrixPadding;
        let y = matY;

        // Write text
        ctx.fillStyle = "black";
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
        let minX = 999;
        let maxX = -999;
        let minY = 999;
        let maxY = -999;
        for (let mino of this.nextMinos) {
            minX = Math.min(minX, mino[0]);
            maxX = Math.max(maxX, mino[0]);
            minY = Math.min(minY, mino[1]);
            maxY = Math.max(maxY, mino[1]);
        }
        let tetrWidth = (maxX - minX + 1) * size;
        let tetrHeight = (maxY - minY + 1) * size;

        // Draw tetrimino
        for (let mino of this.nextMinos) {
            this.drawBlock(
                x + (width * size)/2 + (mino[0] - minX) * size - tetrWidth/2,
                y + (width * size)/2 + (mino[1] - minY) * size - tetrHeight/2,
                size, TetriminoColors[this.nextTetrimino]
            );
        }
    }

    private drawScore() {
        let size = this.getBlockSize();
        let [matX, matY] = this.getMatrixPos(size);
        let ctx = this.context;

        let x = matX + size * this.cfg.matrixWidth + this.cfg.matrixPadding;
        let y = matY 
            + this.cfg.fontSize + this.cfg.textPadding
            + this.cfg.nextPreviewSize * size 
            + this.cfg.textPadding;

        // Write label
        ctx.fillStyle = "black";
        ctx.font = `${this.cfg.fontSize}px ${this.cfg.fontFamily}`;
        ctx.fillText("score", x, y + this.cfg.fontSize);
        y += this.cfg.fontSize;

        // Write score
        ctx.font = `${this.cfg.bigFontSize}px ${this.cfg.fontFamily}`;
        ctx.fillText(this.score.toString(), x, y + this.cfg.bigFontSize);
    }

    private drawLevel() {
        let size = this.getBlockSize();
        let [matX, matY] = this.getMatrixPos(size);
        let ctx = this.context;

        let x = matX + size * this.cfg.matrixWidth + this.cfg.matrixPadding;
        let y = matY 
            + this.cfg.fontSize + this.cfg.textPadding // next preview
            + this.cfg.nextPreviewSize * size 
            + this.cfg.textPadding
            + this.cfg.fontSize + this.cfg.bigFontSize
            + this.cfg.textPadding;

        // Write label
        ctx.fillStyle = "black";
        ctx.font = `${this.cfg.fontSize}px ${this.cfg.fontFamily}`;
        ctx.fillText("level", x, y + this.cfg.fontSize);
        y += this.cfg.fontSize;

        // Write level
        ctx.font = `${this.cfg.bigFontSize}px ${this.cfg.fontFamily}`;
        ctx.fillText(this.level.toString(), x, y + this.cfg.bigFontSize);
    }

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

    private getBlockSize(): number {
        let a = (this.canvas.width - this.cfg.matrixPadding*2) 
                / this.cfg.matrixWidth;
        let b = (this.canvas.height - this.cfg.matrixPadding*2) 
                / this.cfg.matrixHeight;
        return Math.min(a, b);
    }
}

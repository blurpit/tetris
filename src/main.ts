import { Rotation, TetriminoShape, Tetris } from "./game";
import { Graphics } from "./graphics";

export type Vec2 = [number, number];

class Controller {
    protected game: Tetris;
    protected graphics: Graphics;
    
    constructor() {
        this.game = new Tetris({
            matrixWidth: 10,
            matrixHeight: 20,

            lockDownTimerMs: 500,
            lockDownInfPlacement: false,
            lockDownExtPlacementMoves: 15,
            linesPerLevel: 10,
            maxLevel: 15,
            softDropSpeedFactor: 20,
        });

        this.graphics = new Graphics({
            canvas: document.getElementById("game-canvas") as HTMLCanvasElement,
            matrixWidth: this.game.cfg.matrixWidth,
            matrixHeight: this.game.cfg.matrixHeight,
            nextPreviewSize: 5,

            showGhost: true,
            bgColor: "#eee",
            matrixBgColor: "#fff",
            matrixStrokeColor: "#000",
            gridColor: "#999",
            matrixPadding: 20,
            blockStrokeWidth: 2,
            fontFamily: "Robot_Font",
            fontSize: 40,
            bigFontSize: 50,
            textPadding: 8,
        });
    }

    protected drawGraphics() {
        let width = this.game.cfg.matrixWidth;
        let height = this.game.cfg.matrixHeight;

        // Set locked down blocks in graphics
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let shape = this.game.matrix[y][x];
                if (shape === null) {
                    this.graphics.clearBlock(x, y);
                } else {
                    this.graphics.setBlock(x, y, shape);
                }
            }
        }

        // Draw tetrimino & ghost tetrimino
        let tet = this.game.tetrimino;
        if (this.graphics.cfg.showGhost) {
            this.graphics.setTetrimino(
                tet.x, this.game.getGhostTetriminoY(), 
                tet.minos, TetriminoShape.Ghost
            );
        }
        this.graphics.setTetrimino(
            tet.x, tet.y, 
            tet.minos, tet.shape
        );

        // Draw next tetrimino
        this.graphics.setNextTetrimino(
            this.game.nextTetrimino.minos,
            this.game.nextTetrimino.shape
        );

        this.graphics.draw();
    }

    protected clearFullLines() {
        this.game.getFullLines().forEach((y) => {
            this.game.clearLine(y);
            this.graphics.clearLine(y);
        });
        this.graphics.setScore(this.game.linesCleared);
        this.graphics.setLevel(this.game.level);
    }

    public moveDown() {
        if (this.game.moveDown()) {
            this.game.lockDown();
            this.clearFullLines();
        }

        // Draw graphics
        this.drawGraphics();
    }

    public moveLeft(): boolean {
        let moved = this.game.moveX(-1);
        this.drawGraphics();
        return moved;
    }

    public moveRight(): boolean {
        let moved = this.game.moveX(1);
        this.drawGraphics();
        return moved;
    }
    
    public rotate(dir: Rotation): boolean {
        let moved = this.game.rotate(dir);
        this.drawGraphics();
        return moved;
    }
    
    public softDrop() {
        // Basic controller doesn't soft drop, so treat
        // soft dropping the same as falling.
        this.moveDown();
    }

    public hardDrop() {
        this.game.hardDrop();
        this.drawGraphics();
    }

    public reset() {
        this.game.reset();
        this.graphics.reset();
    }
}

class HumanController extends Controller {
    private fallTimer: NodeJS.Timeout | null;
    private lockDownTimer: NodeJS.Timeout | null;
    private lockDownMoveCount: number;
    private isSoftDropping: boolean;

    constructor() {
        super();
        this.addEventListeners();

        this.fallTimer = null;
        this.lockDownTimer = null;
        this.lockDownMoveCount = 0;
        this.isSoftDropping = false;
    }

    public start() {
        this.startFallLoop();
        this.drawGraphics();
    }

    public moveDown() {
        if (this.game.moveDown()) {
            this.interruptFallLoop();
            this.startLockDownTimer();
        }

        // Draw graphics
        this.drawGraphics();
    }

    public softDrop() {
        if (!this.isSoftDropping) {
            this.isSoftDropping = true;
            this.interruptFallLoop();
            this.startFallLoop();
            this.moveDown(); // move down instantly
        }
    }

    public hardDrop() {
        this.interruptLockDownTimer();
        this.game.hardDrop();
        this.lockDown();
        this.drawGraphics();
    }

    public reset() {
        super.reset();
        this.interruptFallLoop();
        this.interruptLockDownTimer();
    }

    protected clearFullLines() {
        let levelBefore = this.game.level;
        super.clearFullLines();

        if (this.game.level !== levelBefore) {
            this.interruptFallLoop();
            this.startFallLoop();
        }
    }

    private endSoftDrop() {
        if (this.isSoftDropping) {
            this.isSoftDropping = false;
            this.interruptFallLoop();
            this.startFallLoop();
        }
    }

    private getFallSpeed() {
        let speed = Math.pow(0.8 - (this.game.level - 1) * 0.007, this.game.level - 1) * 1000;
        if (this.isSoftDropping) {
            return speed / this.game.cfg.softDropSpeedFactor;
        }
        return speed;
    }

    private startFallLoop() {
        this.interruptFallLoop();
        this.fallTimer = setInterval(this.moveDown.bind(this), this.getFallSpeed());
    }

    private interruptFallLoop() {
        if (this.fallTimer !== null) {
            clearInterval(this.fallTimer);
            this.fallTimer = null;
        }
    }

    private startLockDownTimer() {
        this.interruptLockDownTimer();
        this.lockDownTimer = setTimeout(this.lockDown.bind(this), this.game.cfg.lockDownTimerMs);
    }

    private interruptLockDownTimer() {
        if (this.lockDownTimer !== null) {
            clearTimeout(this.lockDownTimer);
            this.lockDownTimer = null;
        }
    }

    private lockDown() {
        this.lockDownTimer = null;
        this.game.lockDown();
        this.clearFullLines();
        this.startFallLoop();
        this.drawGraphics();
    }

    private addEventListeners() {
        addEventListener("keydown", (e) => {
            let moved = false;

            switch (e.key) {
                case "ArrowLeft":
                    moved = this.moveLeft();
                    break;
                case "ArrowRight":
                    moved = this.moveRight();
                    break;
                case "ArrowUp":
                    moved = this.rotate(Rotation.CW);
                    break;
                case "x":
                    moved = this.rotate(Rotation.CW);
                    break;
                case "z":
                    moved = this.rotate(Rotation.CCW);
                    break;
                case "ArrowDown":
                    this.softDrop();
                    break;
                case " ":
                    this.hardDrop();
                    break;
                case "r":
                    this.reset();
                    this.start();
                    break;
            }

            if (moved && this.lockDownTimer !== null) {
                this.interruptLockDownTimer();
                this.startFallLoop();
            }
        });

        addEventListener("keyup", (e) => {
            switch (e.key) {
                case "ArrowDown":
                    this.endSoftDrop();
                    break;
            }
        });
    }
}

new HumanController().start();
/* ==========================================================================
   Antigravity Auth - Cyber Snake Game (720x480 Widescreen & Atan2 Mouse Engine)
   ========================================================================== */

class CyberSnakeGame {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.tileSize = 20;
    this.tileCountX = Math.floor(this.canvas.width / this.tileSize); // 36 tiles
    this.tileCountY = Math.floor(this.canvas.height / this.tileSize); // 24 tiles

    this.snake = [];
    this.food = { x: 10, y: 10 };
    this.dx = 1;
    this.dy = 0;
    this.nextDx = 1;
    this.nextDy = 0;
    
    this.score = 0;
    this.highScore = 0;
    this.speed = 75;
    this.gameLoop = null;
    this.isPaused = false;
    this.isRunning = false;

    // Mouse Tracking & Visual Effects
    this.mouseX = this.canvas.width / 2;
    this.mouseY = this.canvas.height / 2;
    this.particles = [];
    this.floatingTexts = [];
    this.foodPulse = 0;

    this.init();
  }

  init() {
    this.bindMouseControls();
    this.bindKeyboardControls();
    this.loadHighScore();
    this.resetGame();

    // Toggle start/pause on canvas click
    this.canvas.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleStartPause();
    });
  }

  loadHighScore() {
    const session = window.db ? window.db.getCurrentSession() : null;
    const userId = session ? session.userId : 'guest';
    const saved = localStorage.getItem(`snake_high_score_${userId}`);
    this.highScore = saved ? parseInt(saved, 10) : 0;
    this.updateScoreDisplay();
  }

  saveHighScore() {
    const session = window.db ? window.db.getCurrentSession() : null;
    const userId = session ? session.userId : 'guest';
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem(`snake_high_score_${userId}`, this.highScore);
      if (window.db) {
        window.db.addAuditLog(userId, session ? session.username : 'user', 'SNAKE_HIGH_SCORE', `New High Score: ${this.highScore} pts`);
      }
    }
    this.updateScoreDisplay();
  }

  resetGame() {
    const startX = Math.floor(this.tileCountX / 3);
    const startY = Math.floor(this.tileCountY / 2);

    this.snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY }
    ];
    this.dx = 1;
    this.dy = 0;
    this.nextDx = 1;
    this.nextDy = 0;
    this.score = 0;
    this.particles = [];
    this.floatingTexts = [];
    this.isPaused = false;
    this.isRunning = false;
    this.spawnFood();
    this.updateScoreDisplay();
    this.draw();

    if (this.gameLoop) clearInterval(this.gameLoop);
    const startBtn = document.getElementById('snake-start-btn');
    if (startBtn) startBtn.innerHTML = '<i class="fa-solid fa-play"></i> เริ่มเล่นเกม';
  }

  start() {
    if (this.isRunning && !this.isPaused) return;

    if (this.isPaused) {
      this.isPaused = false;
    } else {
      this.resetGame();
      this.isRunning = true;
    }

    const difficultySelect = document.getElementById('snake-difficulty');
    const speedVal = difficultySelect ? parseInt(difficultySelect.value, 10) : 75;
    this.speed = speedVal;

    if (this.gameLoop) clearInterval(this.gameLoop);
    this.gameLoop = setInterval(() => this.update(), this.speed);

    const startBtn = document.getElementById('snake-start-btn');
    if (startBtn) startBtn.innerHTML = '<i class="fa-solid fa-pause"></i> หยุดชั่วคราว';
  }

  pause() {
    if (!this.isRunning) return;
    this.isPaused = true;
    if (this.gameLoop) clearInterval(this.gameLoop);
    const startBtn = document.getElementById('snake-start-btn');
    if (startBtn) startBtn.innerHTML = '<i class="fa-solid fa-play"></i> เล่นต่อ';
    this.drawPauseOverlay();
  }

  toggleStartPause() {
    if (!this.isRunning || this.isPaused) {
      this.start();
    } else {
      this.pause();
    }
  }

  spawnFood() {
    let valid = false;
    while (!valid) {
      this.food = {
        x: Math.floor(Math.random() * this.tileCountX),
        y: Math.floor(Math.random() * this.tileCountY)
      };
      valid = !this.snake.some(segment => segment.x === this.food.x && segment.y === this.food.y);
    }
  }

  // Particle FX
  createParticles(x, y, color, count = 16) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color,
        life: 1.0,
        decay: Math.random() * 0.04 + 0.02
      });
    }
  }

  createFloatingText(x, y, text, color = '#38bdf8') {
    this.floatingTexts.push({
      x, y, text, color, alpha: 1.0, vy: -1.5
    });
  }

  update() {
    if (this.isPaused || !this.isRunning) return;

    // Apply next direction
    this.dx = this.nextDx;
    this.dy = this.nextDy;

    // Calculate new head position
    const head = { x: this.snake[0].x + this.dx, y: this.snake[0].y + this.dy };

    // Wall Collision Check
    if (head.x < 0 || head.x >= this.tileCountX || head.y < 0 || head.y >= this.tileCountY) {
      this.gameOver();
      return;
    }

    // Self Collision Check
    if (this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
      this.gameOver();
      return;
    }

    this.snake.unshift(head);

    const headPxX = (head.x + 0.5) * this.tileSize;
    const headPxY = (head.y + 0.5) * this.tileSize;

    // Food Collision Check
    if (head.x === this.food.x && head.y === this.food.y) {
      this.score += 10;
      this.saveHighScore();

      this.createParticles(headPxX, headPxY, '#f43f5e', 22);
      this.createFloatingText(headPxX, headPxY - 10, '+10', '#10b981');
      this.spawnFood();
    } else {
      this.snake.pop();
    }

    // Update Particles & FX
    this.particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.life -= p.decay;
    });
    this.particles = this.particles.filter(p => p.life > 0);

    this.floatingTexts.forEach(t => {
      t.y += t.vy; t.alpha -= 0.03;
    });
    this.floatingTexts = this.floatingTexts.filter(t => t.alpha > 0);

    this.draw();
  }

  gameOver() {
    this.isRunning = false;
    if (this.gameLoop) clearInterval(this.gameLoop);
    this.saveHighScore();

    const headPxX = (this.snake[0].x + 0.5) * this.tileSize;
    const headPxY = (this.snake[0].y + 0.5) * this.tileSize;
    this.createParticles(headPxX, headPxY, '#f43f5e', 35);

    if (window.ui) {
      window.ui.showToast('Game Over!', `เกมจบลงแล้ว! คุณทำคะแนนได้ ${this.score} คะแนน`, 'error');
    }

    const startBtn = document.getElementById('snake-start-btn');
    if (startBtn) startBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> เล่นใหม่อีกครั้ง';

    this.drawGameOverOverlay();
  }

  draw() {
    const size = this.tileSize;
    this.foodPulse += 0.08;

    // Clear Canvas
    this.ctx.fillStyle = '#060814';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw Subtle Cyber Grid
    this.ctx.strokeStyle = 'rgba(99, 102, 241, 0.05)';
    this.ctx.lineWidth = 1;
    for (let i = 0; i <= this.tileCountX; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(i * size, 0);
      this.ctx.lineTo(i * size, this.canvas.height);
      this.ctx.stroke();
    }
    for (let j = 0; j <= this.tileCountY; j++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, j * size);
      this.ctx.lineTo(this.canvas.width, j * size);
      this.ctx.stroke();
    }

    // Draw Laser Guide Line from Head to Mouse
    if (this.snake.length > 0 && this.isRunning && !this.isPaused) {
      const headPxX = (this.snake[0].x + 0.5) * size;
      const headPxY = (this.snake[0].y + 0.5) * size;

      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
      this.ctx.lineWidth = 1.5;
      this.ctx.setLineDash([4, 4]);
      this.ctx.beginPath();
      this.ctx.moveTo(headPxX, headPxY);
      this.ctx.lineTo(this.mouseX, this.mouseY);
      this.ctx.stroke();

      // Mouse Crosshair Cursor Glow
      this.ctx.shadowColor = '#06b6d4';
      this.ctx.shadowBlur = 12;
      this.ctx.fillStyle = '#06b6d4';
      this.ctx.beginPath();
      this.ctx.arc(this.mouseX, this.mouseY, 5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // Draw Food
    this.ctx.save();
    const foodRadius = size / 2 - 2 + Math.sin(this.foodPulse) * 1.5;
    const foodX = (this.food.x + 0.5) * size;
    const foodY = (this.food.y + 0.5) * size;

    this.ctx.shadowColor = '#f43f5e';
    this.ctx.shadowBlur = 18;
    this.ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
    this.ctx.beginPath();
    this.ctx.arc(foodX, foodY, foodRadius + 4, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#f43f5e';
    this.ctx.beginPath();
    this.ctx.arc(foodX, foodY, Math.max(2, foodRadius), 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // Draw Snake Segments
    this.snake.forEach((segment, index) => {
      this.ctx.save();
      const isHead = index === 0;
      const x = segment.x * size + 1;
      const y = segment.y * size + 1;
      const w = size - 2;
      const h = size - 2;

      if (isHead) {
        this.ctx.shadowColor = '#6366f1';
        this.ctx.shadowBlur = 15;
        this.ctx.fillStyle = '#6366f1';
      } else {
        const opacity = Math.max(0.35, 1 - (index / this.snake.length) * 0.55);
        this.ctx.shadowColor = '#8b5cf6';
        this.ctx.shadowBlur = 6;
        this.ctx.fillStyle = `rgba(139, 92, 246, ${opacity})`;
      }

      if (typeof this.ctx.roundRect === 'function') {
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, w, h, isHead ? 6 : 4);
        this.ctx.fill();
      } else {
        this.ctx.fillRect(x, y, w, h);
      }

      // Snake Eyes
      if (isHead) {
        this.ctx.fillStyle = '#ffffff';
        const eyeOffset = size / 4;
        const eyeRadius = 2.5;

        let eyeX1 = x + eyeOffset, eyeY1 = y + eyeOffset;
        let eyeX2 = x + w - eyeOffset, eyeY2 = y + eyeOffset;

        if (this.dx === 1) {
          eyeX1 = x + w - eyeOffset; eyeY1 = y + eyeOffset;
          eyeX2 = x + w - eyeOffset; eyeY2 = y + h - eyeOffset;
        } else if (this.dx === -1) {
          eyeX1 = x + eyeOffset; eyeY1 = y + eyeOffset;
          eyeX2 = x + eyeOffset; eyeY2 = y + h - eyeOffset;
        } else if (this.dy === 1) {
          eyeX1 = x + eyeOffset; eyeY1 = y + h - eyeOffset;
          eyeX2 = x + w - eyeOffset; eyeY2 = y + h - eyeOffset;
        }

        this.ctx.beginPath();
        this.ctx.arc(eyeX1, eyeY1, eyeRadius, 0, Math.PI * 2);
        this.ctx.arc(eyeX2, eyeY2, eyeRadius, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.restore();
    });

    // Render Particles
    this.particles.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = p.life;
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 8;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    // Render Floating Text
    this.floatingTexts.forEach(t => {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, t.alpha);
      this.ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
      this.ctx.fillStyle = t.color;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(t.text, t.x, t.y);
      this.ctx.restore();
    });

    // Start Overlay
    if (!this.isRunning && !this.isPaused) {
      this.drawStartOverlay();
    }
  }

  drawStartOverlay() {
    this.ctx.fillStyle = 'rgba(6, 8, 20, 0.82)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
    this.ctx.fillStyle = '#38bdf8';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('CYBER SNAKE WIDESCREEN', this.canvas.width / 2, this.canvas.height / 2 - 25);

    this.ctx.font = '15px "Plus Jakarta Sans", sans-serif';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillText('บังคับด้วยเมาส์สุดลื่นไหล - เลื่อนเมาส์บนหน้าจอเพื่อนำทาง', this.canvas.width / 2, this.canvas.height / 2 + 15);

    this.ctx.font = '14px "Plus Jakarta Sans", sans-serif';
    this.ctx.fillStyle = '#6366f1';
    this.ctx.fillText('คลิกที่นี่ เพื่อเริ่มเล่นเกมทันที!', this.canvas.width / 2, this.canvas.height / 2 + 50);
  }

  drawPauseOverlay() {
    this.ctx.fillStyle = 'rgba(6, 8, 20, 0.75)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
    this.ctx.fillStyle = '#6366f1';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('PAUSED (หยุดชั่วคราว)', this.canvas.width / 2, this.canvas.height / 2);
  }

  drawGameOverOverlay() {
    this.ctx.fillStyle = 'rgba(6, 8, 20, 0.85)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
    this.ctx.fillStyle = '#f43f5e';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('GAME OVER!', this.canvas.width / 2, this.canvas.height / 2 - 18);

    this.ctx.font = '16px "Plus Jakarta Sans", sans-serif';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillText(`คะแนนของคุณ: ${this.score} คะแนน`, this.canvas.width / 2, this.canvas.height / 2 + 15);

    this.ctx.font = '14px "Plus Jakarta Sans", sans-serif';
    this.ctx.fillStyle = '#38bdf8';
    this.ctx.fillText('คลิกที่นี่เพื่อเริ่มเล่นใหม่อีกครั้ง', this.canvas.width / 2, this.canvas.height / 2 + 50);
  }

  updateScoreDisplay() {
    const scoreElem = document.getElementById('snake-current-score');
    const highScoreElem = document.getElementById('snake-high-score');
    if (scoreElem) scoreElem.textContent = this.score;
    if (highScoreElem) highScoreElem.textContent = this.highScore;
  }

  // --- ULTRA SMOOTH ATAN2 MOUSE STEERING ---
  bindMouseControls() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;

      this.mouseX = (e.clientX - rect.left) * scaleX;
      this.mouseY = (e.clientY - rect.top) * scaleY;

      if (!this.isRunning) {
        // Auto start on mouse movement inside canvas
        this.start();
      }

      this.updateDirectionFromMouseAngle();
    });
  }

  updateDirectionFromMouseAngle() {
    if (!this.snake || this.snake.length === 0) return;

    const headPxX = (this.snake[0].x + 0.5) * this.tileSize;
    const headPxY = (this.snake[0].y + 0.5) * this.tileSize;

    const diffX = this.mouseX - headPxX;
    const diffY = this.mouseY - headPxY;

    // Ignore tiny movements right at the head
    if (Math.hypot(diffX, diffY) < 15) return;

    // Calculate angle in degrees (-180 to 180)
    const angle = Math.atan2(diffY, diffX) * (180 / Math.PI);

    // Determine target direction based on 4 quadrant octants
    if (angle >= -45 && angle < 45) {
      if (this.dx !== -1) { this.nextDx = 1; this.nextDy = 0; } // Right
    } else if (angle >= 45 && angle < 135) {
      if (this.dy !== -1) { this.nextDx = 0; this.nextDy = 1; } // Down
    } else if (angle >= 135 || angle < -135) {
      if (this.dx !== 1) { this.nextDx = -1; this.nextDy = 0; } // Left
    } else if (angle >= -135 && angle < -45) {
      if (this.dy !== 1) { this.nextDx = 0; this.nextDy = -1; } // Up
    }
  }

  bindKeyboardControls() {
    window.addEventListener('keydown', (e) => {
      const snakeTab = document.getElementById('tab-snake-game');
      if (!snakeTab || !snakeTab.classList.contains('active')) return;

      if (!this.isRunning && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key)) {
        this.start();
      }

      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
          if (this.dy === 0) { this.nextDx = 0; this.nextDy = -1; } e.preventDefault(); break;
        case 'ArrowDown': case 's': case 'S':
          if (this.dy === 0) { this.nextDx = 0; this.nextDy = 1; } e.preventDefault(); break;
        case 'ArrowLeft': case 'a': case 'A':
          if (this.dx === 0) { this.nextDx = -1; this.nextDy = 0; } e.preventDefault(); break;
        case 'ArrowRight': case 'd': case 'D':
          if (this.dx === 0) { this.nextDx = 1; this.nextDy = 0; } e.preventDefault(); break;
        case ' ':
          this.toggleStartPause(); e.preventDefault(); break;
      }
    });
  }
}

window.initSnakeGame = function() {
  if (!window.snakeGame) {
    window.snakeGame = new CyberSnakeGame('snake-canvas');
  } else {
    window.snakeGame.loadHighScore();
    window.snakeGame.draw();
  }
};

'use strict';
const Chart = function () {
	const queueActions = Symbol('queueActions'),
		selectedColor = Symbol('selectedColor'),
		backgroundColor = Symbol('backgroundColor'),
		lineColor = Symbol('lineColor'),
		cursorColor = Symbol('cursorColor'),
		gridColor = Symbol('gridColor'),
		rectColor = Symbol('rectColor'),
		textColor = Symbol('textColor'),
		cursorTextColor = Symbol('cursorTextColor'),
		rangeChange = Symbol('rangeChange'),
		cursorChange = Symbol('cursorChange'),
		paiting = Symbol('paiting'),
		canvas2d = Symbol('canvas2d'),
		canvas3d = Symbol('canvas3d'),
		gl = Symbol('gl'),
		ground = Symbol('ground'),
		HV = Symbol('HV'),
		BASE = Symbol('BASE'),
		MAX = Symbol('MAX'),
		COLOR = Symbol('COLOR'),
		POSITION = Symbol('POSITION'),
		OFFSET = Symbol('OFFSET'),
		WV = Symbol('WV'),
		paddingX = Symbol('paddingX'),
		paddingY = Symbol('paddingY'),
		paddingLeft = Symbol('paddingLeft'),
		fontSize = Symbol('fontSize'),
		oldbegin = Symbol('oldbegin'),
		oldend = Symbol('oldend'),
		stage = Symbol('stage'),
		begin = Symbol('begin'),
		end = Symbol('end'),
		cursor = Symbol('cursor'),
		selected = Symbol('selected'),
		sorting = Symbol('sorting'),
		xLableing = Symbol('xLableing'),
		max = Symbol('max'),
		min = Symbol('min'),
		lines = Symbol('lines'),
		minLen = Symbol('minLen'),
		mouseListener = Symbol('mouseListener'),
		vs = `attribute vec2 POSITION;
		attribute float WV;
		attribute float HV;
		attribute float MAX;
		attribute float BASE;
		attribute float OFFSET;
		void main(void) {
			if (POSITION.y != 0.0) {
				gl_Position = vec4((POSITION.x - OFFSET) * 2.0 / WV - 1.0, ((POSITION.y - BASE) / BASE - MAX) * 2.0 / HV + 1.0, 0.0, 1.0);
			} else if (WV != 0.0) {
				gl_Position = vec4(OFFSET * 2.0 / WV - 1.0, POSITION.x, 0.0, 1.0);
			} else if (OFFSET != 0.0) {
				gl_Position = vec4(POSITION.x, OFFSET * -2.0 + 1.0, 0.0, 1.0);
			} else if (POSITION.x == 1.0) {
				gl_Position = vec4(1.0, -1.0, 0.0, 1.0);
			} else if (POSITION.x == 2.0) {
				gl_Position = vec4(1.0, 1.0, 0.0, 1.0);
			} else if (POSITION.x == 3.0) {
				gl_Position = vec4(-1.0, 1.0, 0.0, 1.0);
			} else {
				gl_Position = vec4(-1.0, -1.0, 0.0, 1.0);
			}
		}`,
		fs = `precision lowp float;
		uniform vec4 COLOR;
		void main(void) {
			gl_FragColor = COLOR;
		}`;

	function Chart(ctn) {
		this.fixed = false;
		this.index = [];
		this.indexOrder = {};
		this[paddingY] = 40;
		this[paddingX] = 60;
		this[paddingLeft] = 50;
		this[fontSize] = 10;
		this[selectedColor] = [0, 0, 0];
		this[backgroundColor] = [1, 1, 1];
		this[lineColor] = [0.75, 0.75, 0.75];
		this[cursorColor] = [1, 0.75, 0.75];
		this[gridColor] = [0.75, 0.75, 1];
		this[rectColor] = [0, 0, 0];
		this[textColor] = [0, 0, 0];
		this[cursorTextColor] = [1, 0, 0];
		this[cursor] = this[begin] = this[end] = this[oldbegin] = this[oldend] = NaN;
		this[queueActions] = [];
		this[lines] = {};
		this[mouseListener] = mousedown.bind(this);
		this[stage] = ctn.appendChild(document.createElement('div'));
		this[stage].style.width = this[stage].style.height = '100%';
		this[stage].style.overflow = 'hidden';
		this[stage].style.position = 'relative';
		this[stage].addEventListener('contextmenu', function (evt) {
			evt.preventDefault();
		});
		this[canvas2d] = this[stage].appendChild(document.createElement('canvas'));
		this[canvas2d].style.display = 'block';
		this[canvas2d].style.width = this[canvas2d].style.height = '100%';
		this[canvas3d] = this[stage].appendChild(document.createElement('canvas'));
		this[canvas3d].style.position = 'absolute';
		this[canvas3d].style.left = this[paddingLeft] + 'px';
		this[canvas3d].style.top = this[fontSize] / 2 + 'px';
		this[canvas3d].style.outline = 'none';
		this[canvas3d].tabIndex = 0;
		this[canvas3d].addEventListener('keydown', keydown.bind(this));
		this[canvas3d].addEventListener('mousedown', this[mouseListener]);
		this[canvas3d].addEventListener('wheel', wheel.bind(this));
		this[ground] = this[canvas2d].getContext('2d');
		this[gl] = this[canvas3d].getContext('webgl', {
			alpha: false,
			premultipliedAlpha: false,
			antialias: true,
			powerPreference: 'high-performance',
			depth: false,
			preserveDrawingBuffer: true
		});
		let vertShader = this[gl].createShader(this[gl].VERTEX_SHADER),
			fragShader = this[gl].createShader(this[gl].FRAGMENT_SHADER),
			program = this[gl].createProgram();
		this[gl].shaderSource(vertShader, vs);
		this[gl].shaderSource(fragShader, fs);
		this[gl].compileShader(fragShader);
		this[gl].compileShader(vertShader);
		this[gl].attachShader(program, vertShader);
		this[gl].attachShader(program, fragShader);
		this[gl].linkProgram(program);
		this[gl].useProgram(program);
		this[POSITION] = this[gl].getAttribLocation(program, 'POSITION');
		this[WV] = this[gl].getAttribLocation(program, 'WV');
		this[OFFSET] = this[gl].getAttribLocation(program, 'OFFSET');
		this[HV] = this[gl].getAttribLocation(program, 'HV');
		this[BASE] = this[gl].getAttribLocation(program, 'BASE');
		this[MAX] = this[gl].getAttribLocation(program, 'MAX');
		this[COLOR] = this[gl].getUniformLocation(program, 'COLOR');
		this[gl].bindBuffer(this[gl].ARRAY_BUFFER, this[gl].createBuffer());
		this[gl].vertexAttribPointer(this[POSITION], 2, this[gl].FLOAT, false, 0, 0);
		this[gl].enableVertexAttribArray(this[POSITION]);
		if (self.ResizeObserver) {
			new ResizeObserver(syncSize.bind(this)).observe(this[stage]);
		} else {
			let frame = this[stage].insertBefore(document.createElement('iframe'), this[canvas2d]);
			frame.style.border = 'none';
			frame.style.display = 'block';
			frame.style.position = 'absolute';
			frame.style.top = frame.style.left = 0;
			frame.style.width = frame.style.height = '100%';
			frame.style.visibility = 'hidden';
			frame.contentWindow.addEventListener('resize', syncSize.bind(this));
		}
		syncSize.call(this);
	}

	Chart.prototype.add = function (data) {
		for (let c in data) {
			if (!this[lines][c]) {
				this[lines][c] = {};
			}
			if (!this[lines][c].data) {
				this[lines][c].data = data[c];
			} else {
				for (let n in data[c]) {
					this[lines][c].data[n] = data[c][n];
				}
			}
		}
		buildIndex.call(this);
	};

	Chart.prototype.remove = function (names) {
		let removed;
		for (let i = 0; i < names.length; i++) {
			if (this[lines].hasOwnProperty(names[i])) {
				removed = true;
				delete this[lines][names[i]];
			}
		}
		if (removed) {
			if (this[selected] && !this[lines].hasOwnProperty(this[selected])) {
				this[selected] = undefined;
			}
			buildIndex.call(this);
		}
		return removed;
	};

	Chart.prototype.setSections = function (sections) {
		let refresh;
		for (let c in sections) {
			if (this[lines].hasOwnProperty(c)) {
				let idx = Object.keys(sections[c]).sort(this[sorting]);
				this[lines][c].sectionStarts = [];
				this[lines][c].colors = [];
				for (let i = 0; i < idx.length; i++) {
					if (this[lines][c].data[idx[i]] > 0) {
						this[lines][c].sectionStarts.push(this.indexOrder[idx[i]]);
						this[lines][c].colors.push(sections[c][idx[i]]);
					}
				}
				if (this[lines][c].sectionStarts[0] !== this[lines][c].first) {
					this[lines][c].sectionStarts.unshift(this[lines][c].first);
					this[lines][c].colors.unshift(this[selectedColor]);
				}
				if (this[selected] === c) {
					refresh = true;
				}
			}
		}
		if (refresh) {
			draw.call(this);
		}
	};

	Chart.prototype.getValue = function (c, pos, relative) {
		if (!pos) {
			pos = this.cursor;
		}
		pos = this.indexOrder[pos];
		if (this.lines.hasOwnProperty(c) && pos >= this[lines][c].first && pos <= this[lines][c].last) {
			while(this[lines][c].data[this.index[pos]] === undefined) {
				pos--;
			}
			return relative ? (this[lines][c].data[this.index[pos]] - this[lines][c].base) / this[lines][c].base : this[lines][c].data[this.index[pos]];
		}
	};

	Chart.prototype.getValues = function (pos, relative) {
		if (!pos) {
			pos = this.cursor;
		}
		pos = this.indexOrder[pos];
		let r = {};
		for (let c in this[lines]) {
			if (pos >= this[lines][c].first && pos <= this[lines][c].last) {
				let p = pos;
				while(this[lines][c].data[this.index[p]] === undefined) {
					p--;
				}
				r[c] = relative ? (this[lines][c].data[this.index[p]] - this[lines][c].base) / this[lines][c].base : this[lines][c].data[this.index[p]];
			}
		}
		return r;
	}

	Chart.prototype.center = function () {
		let len = Math.ceil((this[end] - this[begin]) / 2);
		return changeRange.call(this, this[cursor] - len, this[cursor] + len);
	};

	Chart.prototype.setRange = function (newbegin, newend) {
		if (this.indexOrder.hasOwnProperty(newbegin) && this.indexOrder.hasOwnProperty(newend)) {
			return changeRange.call(this, this.indexOrder[newbegin], this.indexOrder[newend]);
		}
	};

	Chart.prototype.moveCursorBy = function (x) {
		return changeCursor.call(this, this[cursor] + x);
	};

	Chart.prototype.moveCoordBy = function (i) {
		if (this[begin] + i < 0) {
			i = -this[begin];
		} else if (this[end] + i > this.index.length - 1) {
			i = this.index.length - 1 - this[end];
		}
		if (i) {
			if (!this[paiting]) {
				this[oldbegin] = this[begin];
				this[oldend] = this[end];
			}
			this[begin] += i;
			this[end] += i;
			this[rangeChange] = true;
			draw.call(this);
			return true;
		}
	};

	Chart.prototype.zoomCoordBy = function (x, percent) {
		let newlen,
			len = this[end] - this[begin];
		if (percent) {
			x = len * x / 100;
		}
		newlen = len + Math[x > 0 ? 'ceil' : 'floor'](x / 2) * 2;
		if (newlen < this[minLen]) {
			newlen = this[minLen];
		} else if (newlen > this.index.length - 1) {
			newlen = this.index.length - 1;
		}
		if (newlen !== len) {
			let l = (newlen - len) / 2;
			if (!this[paiting]) {
				this[oldbegin] = this[begin];
				this[oldend] = this[end];
			}
			this[begin] -= Math.ceil(l);
			this[end] += Math.floor(l);
			if (this[begin] < 0) {
				this[end] -= this[begin];
				this[begin] = 0;
			} else if (this[end] > this.index.length - 1) {
				this[begin] += this.index.length - 1 - this[end];
				this[end] = this.index.length - 1;
			}
			this[rangeChange] = true;
			draw.call(this);
			return true;
		}
	};

	Chart.prototype.copy = function () {
		let canvas = document.createElement('canvas'),
			ctx = canvas.getContext('2d');
		canvas.width = this[canvas2d].width;
		canvas.height = this[canvas2d].height;
		ctx.drawImage(this[canvas2d], 0, 0, this[canvas2d].width, this[canvas2d].height);
		this[gl].finish();
		ctx.drawImage(this[canvas3d], 0, 0, this[canvas3d].width, this[canvas3d].height, this[paddingLeft] * devicePixelRatio, this[fontSize] * devicePixelRatio / 2, this[canvas3d].width, this[canvas3d].height);
		return canvas;
	};

	Object.defineProperty(Chart.prototype, 'begin', {
		get: function () {
			return this.index[this[begin]];
		},
		set: function (newbegin) {
			this.setRange(newbegin, this.end);
		}
	});

	Object.defineProperty(Chart.prototype, 'end', {
		get: function () {
			return this.index[this[end]];
		},
		set: function (newend) {
			this.setRange(this.begin, newend);
		}
	});

	Object.defineProperty(Chart.prototype, 'cursor', {
		get: function () {
			return this.index[this[cursor]];
		},
		set: function (cur) {
			if (this.indexOrder.hasOwnProperty(cur)) {
				changeCursor.call(this, this.indexOrder[cur]);
			}
		}
	});

	Object.defineProperty(Chart.prototype, 'selected', {
		get: function () {
			return this[selected];
		},
		set: function (c) {
			c = String(c);
			if (!this[lines].hasOwnProperty(c)) {
				this[selected] = undefined;
			} else if (this[selected] !== c) {
				this[selected] = c;
			} else {
				return;
			}
			draw.call(this);
		}
	});

	Object.defineProperty(Chart.prototype, 'paddingY', {
		get: function () {
			return this[paddingY];
		},
		set: function (y) {
			this[paddingY] = y;
			draw.call(this);
		}
	});

	Object.defineProperty(Chart.prototype, 'paddingX', {
		get: function () {
			return this[paddingX];
		},
		set: function (x) {
			this[paddingX] = x;
			syncSize.call(this);
		}
	});

	Object.defineProperty(Chart.prototype, 'paddingLeft', {
		get: function () {
			return this[paddingLeft];
		},
		set: function (x) {
			this[paddingLeft] = x;
			this[canvas3d].style.left = x + 'px';
			syncSize.call(this);
		}
	});

	Object.defineProperty(Chart.prototype, 'fontSize', {
		get: function () {
			return this[fontSize];
		},
		set: function (x) {
			this[fontSize] = x;
			this[canvas3d].style.top = x / 2 + 'px';
			syncSize.call(this);
		}
	});

	Object.defineProperty(Chart.prototype, 'sorting', {
		get: function () {
			return this[sorting];
		},
		set: function (func) {
			this[sorting] = func;
			let sections = {};
			for (let c in this[lines]) {
				if (this[lines][c].sectionStarts && this[lines][c].colors) {
					sections[c] = {};
					for (let i = 0; i < this[lines][c].sectionStarts.length; i++) {
						sections[c][this[lines][c].sectionStarts[i]] = this[lines][c].colors[i];
					}
				}
			}
			buildIndex.call(this);
			this.setSections(sections);
		}
	});

	Object.defineProperty(Chart.prototype, 'xLableing', {
		get: function () {
			return this[xLableing];
		},
		set: function (func) {
			this[xLableing] = func;
			draw.call(this);
		}
	});

	Object.defineProperty(Chart.prototype, 'selectedColor', {
		get: function () {
			return this[selectedColor];
		},
		set: function (c) {
			this[selectedColor] = c;
			draw.call(this);
		}
	});

	Object.defineProperty(Chart.prototype, 'backgroundColor', {
		get: function () {
			return this[backgroundColor];
		},
		set: function (c) {
			this[backgroundColor] = c;
			draw.call(this);
		}
	});

	Object.defineProperty(Chart.prototype, 'lineColor', {
		get: function () {
			return this[lineColor];
		},
		set: function (c) {
			this[lineColor] = c;
			draw.call(this);
		}
	});

	Object.defineProperty(Chart.prototype, 'cursorColor', {
		get: function () {
			return this[cursorColor];
		},
		set: function (c) {
			this[cursorColor] = c;
			draw.call(this);
		}
	});

	Object.defineProperty(Chart.prototype, 'gridColor', {
		get: function () {
			return this[gridColor];
		},
		set: function (c) {
			this[gridColor] = c;
			draw.call(this);
		}
	});

	Object.defineProperty(Chart.prototype, 'rectColor', {
		get: function () {
			return this[rectColor];
		},
		set: function (c) {
			this[rectColor] = c;
			draw.call(this);
		}
	});

	Object.defineProperty(Chart.prototype, 'textColor', {
		get: function () {
			return this[textColor];
		},
		set: function (c) {
			this[textColor] = c;
			draw.call(this);
		}
	});

	Object.defineProperty(Chart.prototype, 'cursorTextColor', {
		get: function () {
			return this[cursorTextColor];
		},
		set: function (c) {
			this[cursorTextColor] = c;
			draw.call(this);
		}
	});

	return Chart;

	function syncSize() {
		let w = this[stage].clientWidth,
			h = this[stage].clientHeight,
			wg = w - this[paddingLeft] - this[paddingX] / 2,
			hg = h - this[fontSize] * 2;
		this[canvas2d].width = w * devicePixelRatio;
		this[canvas2d].height = h * devicePixelRatio;
		this[canvas3d].width = wg * devicePixelRatio;
		this[canvas3d].height = hg * devicePixelRatio;
		this[canvas3d].style.width = wg + 'px';
		this[canvas3d].style.height = hg + 'px';
		this[ground].scale(devicePixelRatio, devicePixelRatio);
		this[gl].viewport(0, 0, this[canvas3d].width, this[canvas3d].height);
		calcLen.call(this);
		if (!changeRange.call(this, this[begin], this[end])) {
			draw.call(this);
		}
	}

	function calcLen() {
		this[minLen] = Math.min(Math.floor(this[canvas3d].clientWidth / this[paddingX]), this.index.length - 1);
	}

	function buildIndex() {
		this.indexOrder = {};
		for (let c in this[lines]) {
			for (let n in this[lines][c].data) {
				if (this[lines][c].data[n] > 0) {
					this.indexOrder[n] = 0;
				} else {
					delete this.indexOrder[n];
				}
			}
		}
		this.index = Object.keys(this.indexOrder).sort(this[sorting]);
		for (let i = 0; i < this.index.length; i++) {
			this.indexOrder[this.index[i]] = i;
		}
		let i = 0;
		for (let c in this[lines]) {
			let line = this[lines][c];
			line.first = line.tmin = Infinity;
			line.last = line.tmax = -Infinity;
			for (let n in line.data) {
				if (line.last < this.indexOrder[n]) {
					line.last = this.indexOrder[n];
				}
				if (line.first > this.indexOrder[n]) {
					line.first = this.indexOrder[n];
				}
				if (line.tmax < line.data[n]) {
					line.tmax = line.data[n];
					line.tmaxi = this.indexOrder[n];
				}
				if (line.tmin > line.data[n]) {
					line.tmin = line.data[n];
					line.tmini = this.indexOrder[n];
				}
			}
			i += line.last - line.first + 1;
		}
		//first 8 numbers are for other use
		let data = new Float32Array(i * 2 + 8);
		data.set([-1, 0, 1, 0, 2, 0, 3, 0]);
		i = 8;
		for (let c in this[lines]) {
			let last,
				line = this[lines][c];
			for (let j = line.first; j <= line.last; j++) {
				let v = line.data[this.index[j]];
				if (v > 0) {
					last = v;
				}
				data[i++] = j;
				data[i++] = last;
			}
		}
		this[gl].bufferData(this[gl].ARRAY_BUFFER, data, this[gl].DYNAMIC_DRAW);
		calcLen.call(this);
		let range = checkRange.call(this, this[begin], this[end]);
		this[begin] = range[0];
		this[end] = range[1];
		this[cursor] = checkCursor.call(this, this[cursor]);
		this[oldbegin] = this[oldend] = undefined;
		this[rangeChange] = this[cursorChange] = true;
		draw.call(this);
	}

	function checkRange(bg, ed) {
		if (this.index.length > 1) {
			if (Number.isNaN(bg) || Number.isNaN(ed)) {
				return [this.index.length - this[minLen] - 1, this.index.length - 1];
			} else {
				ed = Math.max(Math.min(ed, this.index.length - 1), this[minLen]);
				return [Math.max(Math.min(bg, ed - this[minLen]), 0), ed];
			}
		} else {
			return [NaN, NaN];
		}
	}

	function changeRange(bg, ed) {
		let range = checkRange.call(this, bg, ed);
		if (range[0] !== this[begin] || range[1] !== this[end]) {
			if (!this[paiting]) {
				this[oldbegin] = this[begin];
				this[oldend] = this[end];
			}
			this[begin] = range[0];
			this[end] = range[1];
			this[rangeChange] = true;
			draw.call(this);
			return true;
		}
	}

	function checkCursor(cur) {
		if (this.index.length) {
			if (Number.isNaN(cur)) {
				return this.index.length - 1;
			} else {
				return Math.max(Math.min(cur, this.index.length - 1), 0);
			}
		} else {
			return NaN;
		}
	}

	function changeCursor(cur) {
		cur = checkCursor.call(this, cur);
		if (this[cursor] !== cur) {
			this[cursor] = cur;
			this[cursorChange] = true;
			draw.call(this);
			return true;
		}
	}

	function draw() {
		if (!this[paiting]) {
			this[paiting] = requestAnimationFrame(realDraw.bind(this));
			if (this.onpaitbegin) {
				this.onpaitbegin({
					type: 'paitbegin'
				});
			}
		}
	}

	function realDraw() {
		let fireRangeChange = this[rangeChange],
			fireCursorChange = this[cursorChange];
		this[ground].clearRect(0, 0, this[canvas2d].clientWidth, this[canvas2d].clientHeight);
		this[ground].font = this[fontSize] + 'px monospace';
		this[gl].clearColor(this[backgroundColor][0], this[backgroundColor][1], this[backgroundColor][2], 1);
		this[gl].clear(this[gl].COLOR_BUFFER_BIT | this[gl].DEPTH_BUFFER_BIT | this[gl].STENCIL_BUFFER_BIT);
		if (this.index.length > 1) {
			if (fireRangeChange) {
				for (let c in this[lines]) {
					let line = this[lines][c],
						bg = Math.max(this[begin], line.first),
						ed = Math.min(this[end], line.last),
						obg = Math.max(this[oldbegin], line.first),
						oed = Math.min(this[oldend], line.last);
					if (bg > line.first && bg < line.last) {
						while (line.data[this.index[bg]] === undefined) {
							bg--;
						}
					}
					if (obg > line.first && obg < line.last) {
						while (line.data[this.index[obg]] === undefined) {
							obg--;
						}
					}
					if (bg !== obg || ed !== oed) {
						if (line.first < ed && line.last > bg) {
							let findmax, findmin;
							if (line.tmaxi >= bg && line.tmaxi <= ed) {
								line.max = line.tmax;
								line.maxi = line.tmaxi;
							} else {
								findmax = true;
							}
							if (line.tmini >= bg && line.tmini <= ed) {
								line.min = line.tmin;
								line.mini = line.tmini;
							} else {
								findmin = true;
							}
							if (findmax || findmin) {
								if (bg > obg && ed < oed) {
									if (findmax && (line.maxi < bg || line.maxi > ed)) {
										line.max = -Infinity;
									}
									if (findmin && (line.mini < bg || line.mini > ed)) {
										line.min = Infinity;
									}
								} else if (bg > obg && bg < oed) {
									if (findmax && line.maxi < bg) {
										line.max = -Infinity;
									}
									if (findmin && line.mini < bg) {
										line.min = Infinity;
									}
									findMaxMin.call(this, oed + 1, ed, findmax && line.max !== -Infinity, findmin && line.min !== Infinity);
								} else if (ed > obg && ed < oed) {
									if (findmax && line.maxi > ed) {
										line.max = -Infinity;
									}
									if (findmin && line.mini > ed) {
										line.min = Infinity;
									}
									findMaxMin.call(this, bg, obg - 1, findmax && line.max !== -Infinity, findmin && line.min !== Infinity);
								} else if (bg <= obg && ed >= oed) {
									findMaxMin.call(this, bg, obg - 1, findmax, findmin);
									findMaxMin.call(this, oed + 1, ed, findmax, findmin);
								} else {
									if (findmax) {
										line.max = -Infinity;
									}
									if (findmin) {
										line.min = Infinity;
									}
								}
								findMaxMin.call(this, bg, ed, line.max === -Infinity, line.min === Infinity);
							}
						} else {
							line.max = -Infinity;
							line.min = Infinity;
							line.maxi = line.mini = NaN;
						}
					}

					function findMaxMin(bg, ed, findmax, findmin) {
						if (findmax && findmin) {
							for (let i = bg; i <= ed; i++) {
								let v = line.data[this.index[i]];
								if (line.max < v) {
									line.max = v;
									line.maxi = i;
								}
								if (line.min > v) {
									line.min = v;
									line.mini = i;
								}
							}
						} else if (findmax) {
							for (let i = bg; i <= ed; i++) {
								let v = line.data[this.index[i]];
								if (line.max < v) {
									line.max = v;
									line.maxi = i;
								}
							}
						} else if (findmin) {
							for (let i = bg; i <= ed; i++) {
								let v = line.data[this.index[i]];
								if (line.min > v) {
									line.min = v;
									line.mini = i;
								}
							}
						}
					}
				}
				this[oldbegin] = this[oldend] = NaN;
				this[rangeChange] = false;
			}
			if (fireRangeChange || fireCursorChange) {
				this[max] = -Infinity;
				this[min] = Infinity;
				for (let c in this[lines]) {
					let line = this[lines][c];
					if (line.first < this[end] && line.last > this[begin]) {
						if (this[cursor] < line.first) {
							line.base = line.data[this.index[line.first]];
						} else if (this[cursor] > line.last) {
							line.base = line.data[this.index[line.last]];
						} else {
							let i = this[cursor];
							while (line.data[this.index[i]] === undefined) {
								i--;
							}
							line.base = line.data[this.index[i]];
						}
						let maxv = (line.max - line.base) / line.base,
							minv = (line.min - line.base) / line.base;
						if (this[max] < maxv) {
							this[max] = maxv;
						}
						if (this[min] > minv) {
							this[min] = minv;
						}
					}
				}
				this[cursorChange] = false;
			}
			let w = this[canvas3d].clientWidth,
				h = this[canvas3d].clientHeight,
				wv = this[end] - this[begin],
				hv = this[max] - this[min],
				wu = w / wv,
				hu = this[max] / hv,
				n = Math.ceil(this[paddingX] * wv / w),
				xys = [],
				curs = [],
				xtxts = [],
				ytxts = [];
			xtxts.push({
				v: this[paddingLeft],
				text: this[xLableing] ? this[xLableing](this.index[this[begin]]) : this.index[this[begin]]
			});
			xtxts.push({
				v: w + this[paddingLeft],
				text: this[xLableing] ? this[xLableing](this.index[this[end]]) : this.index[this[end]]
			});
			if (this[cursor] >= this[begin] && this[cursor] <= this[end]) {
				let n1 = Math.floor((this[end] - this[cursor]) / n),
					n2 = (this[end] - this[cursor]) / n1;
				for (let i = 1; i < n1; i++) {
					pushx.call(this, this[cursor] + Math.round(i * n2));
				}
				n1 = Math.floor((this[cursor] - this[begin]) / n);
				n2 = (this[cursor] - this[begin]) / n1;
				for (let i = 1; i < n1; i++) {
					pushx.call(this, this[cursor] - Math.round(i * n2));
				}
				let x = this[cursor] - this[begin];
				curs.push({
					x: x
				});
				xtxts.push({
					v: x * wu + this[paddingLeft],
					text: this[xLableing] ? this[xLableing](this.index[this[cursor]]) : this.index[this[cursor]]
				});
			} else {
				let n1 = Math.floor((this[end] - this[begin]) / n),
					n2 = (this[end] - this[begin]) / n1;
				for (let i = 1; i < n1; i++) {
					pushx.call(this, this[cursor] < this[begin] ? this[begin] + Math.round(i * n2) : this[end] - Math.round(i * n2));
				}
			}
			ytxts.push({
				v: this[fontSize] / 2,
				text: Math.round(this[max] * 1000) / 10 + '%'
			});
			ytxts.push({
				v: h + this[fontSize] / 2,
				text: Math.round(this[min] * 1000) / 10 + '%'
			});
			if (this[max] >= 0 && this[min] <= 0) {
				let m = Math.floor(hu * h / this[paddingY]);
				for (let i = 1; i < m; i++) {
					pushy.call(this, hu - hu * i / m, this[max] * i / m);
				}
				m = Math.floor((1 - hu) * h / this[paddingY]);
				for (let i = 1; i < m; i++) {
					pushy.call(this, hu + (1 - hu) * i / m, this[min] * i / m);
				}
				if (this[max] === 0) {
					ytxts.push(ytxts.shift());
				} else if (this[min] === 0) {
					ytxts.push(ytxts.splice(1, 1)[0]);
				} else {
					curs.push({
						y: hu
					});
					ytxts.push({
						v: hu * h + this[fontSize] / 2,
						text: '0%'
					});
				}
			} else {
				let m = Math.floor(h / this[paddingY]);
				for (let i = 1; i < m; i++) {
					pushy.call(this, 1 - i / m, this[max] * i / m);
				}
			}
			let selPos,
				pos = 4;
			drawText.call(this, xtxts, h + this[fontSize]);
			drawText.call(this, ytxts);
			this[gl].vertexAttrib1f(this[WV], wv);
			this[gl].vertexAttrib1f(this[HV], hv);
			this[gl].vertexAttrib1f(this[MAX], this[max]);
			this[gl].uniform4f(this[COLOR], this[lineColor][0], this[lineColor][1], this[lineColor][2], 1);
			for (let c in this[lines]) {
				let line = this[lines][c];
				if (c === this[selected]) {
					selPos = pos;
				} else if (line.first < this[end] && line.last > this[begin]) {
					drawPolyline.call(this, line, pos - line.first + Math.max(this[begin], line.first), pos - line.first + Math.min(this[end], line.last));
				}
				pos += line.last - line.first + 1;
			}
			this[gl].uniform4f(this[COLOR], this[gridColor][0], this[gridColor][1], this[gridColor][2], 1);
			drawxy.call(this, xys);
			this[gl].uniform4f(this[COLOR], this[cursorColor][0], this[cursorColor][1], this[cursorColor][2], 1);
			drawxy.call(this, curs);
			if (this[selected] && this[lines][this[selected]].first < this[end] && this[lines][this[selected]].first + this[lines][this[selected]].last > this[begin]) {
				let line = this[lines][this[selected]],
					bg = Math.max(this[begin], line.first),
					colors = [],
					sectionStarts = [bg];
				if (line.sectionStarts) {
					for (let i = 0; i < line.sectionStarts.length; i++) {
						if (line.sectionStarts[i] <= bg) {
							colors[0] = line.colors[i];
						} else if (line.sectionStarts[i] < this[end]) {
							sectionStarts.push(line.sectionStarts[i]);
							colors.push(line.colors[i]);
						} else {
							break;
						}
					}
				} else {
					colors[0] = this[selectedColor];
				}
				this[gl].vertexAttrib1f(this[WV], wv);
				this[gl].vertexAttrib1f(this[HV], hv);
				this[gl].vertexAttrib1f(this[MAX], this[max]);
				for (let i = 0; i < sectionStarts.length; i++) {
					this[gl].uniform4f(this[COLOR], colors[i][0], colors[i][1], colors[i][2], 1);
					drawPolyline.call(this, line, selPos - line.first + sectionStarts[i], selPos - line.first + (i === sectionStarts.length - 1 ? Math.min(this[end], line.last) : sectionStarts[i + 1]));
				}
			}

			function drawPolyline(line, bg, ed) {
				this[gl].vertexAttrib1f(this[OFFSET], this[begin]);
				this[gl].vertexAttrib1f(this[BASE], line.base);
				this[gl].drawArrays(this[gl].LINE_STRIP, bg, ed - bg + 1);
			}

			function pushx(i) {
				let x = i - this[begin];
				xys.push({
					x: x
				});
				xtxts.push({
					v: x * wu + this[paddingLeft],
					text: this[xLableing] ? this[xLableing](this.index[i]) : this.index[i]
				});
			}

			function pushy(y, v) {
				xys.push({
					y: y
				});
				ytxts.push({
					v: y * h + this[fontSize] / 2,
					text: Math.round(v * 1000) / 10 + '%'
				});
			}

			function drawxy(pos) {
				for (let i = 0; i < pos.length; i++) {
					if (pos[i].hasOwnProperty('x')) {
						this[gl].vertexAttrib1f(this[WV], wv);
						this[gl].vertexAttrib1f(this[OFFSET], pos[i].x);
					} else {
						this[gl].vertexAttrib1f(this[WV], 0);
						this[gl].vertexAttrib1f(this[OFFSET], pos[i].y);
					}
					this[gl].drawArrays(this[gl].LINE_STRIP, 0, 2);
				}
			}

			function drawText(pos, y) {
				if (y === undefined) {
					let x = this[paddingLeft] - this[fontSize] / 2;
					this[ground].textAlign = 'right';
					this[ground].textBaseline = 'middle';
					this[ground].fillStyle = translateColor(this[textColor]);
					for (let i = 0; i < pos.length; i++) {
						if (i === pos.length - 1 && this[max] >= 0 && this[min] <= 0) {
							this[ground].fillStyle = translateColor(this[cursorTextColor]);
						}
						this[ground].fillText(pos[i].text, x, pos[i].v);
					}
				} else {
					this[ground].textAlign = 'center';
					this[ground].textBaseline = 'top';
					this[ground].fillStyle = translateColor(this[textColor]);
					for (let i = 0; i < pos.length; i++) {
						if (i === pos.length - 1 && this[cursor] >= this[begin] && this[cursor] <= this[end]) {
							this[ground].fillStyle = translateColor(this[cursorTextColor]);
						}
						this[ground].fillText(pos[i].text, pos[i].v, y);
					}
				}
			}
		}
		this[gl].vertexAttrib1f(this[WV], 0);
		this[gl].vertexAttrib1f(this[OFFSET], 0);
		this[gl].uniform4f(this[COLOR], this[rectColor][0], this[rectColor][1], this[rectColor][2], 1);
		this[gl].drawArrays(this[gl].LINE_LOOP, 0, 4);
		this[paiting] = 0;
		if (this.onpaitend) {
			this.onpaitend({
				type: 'paitend'
			});
		}
		if (fireRangeChange && this.onrangechange) {
			this.onrangechange({
				type: 'rangechange'
			});
		}
		if (fireCursorChange && this.oncursorchange) {
			this.oncursorchange({
				type: 'cursorchange'
			});
		}
	}

	function translateColor(c) {
		return 'rgb(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ')';
	}

	function mousedown(evt) {
		let btn, mousemove,
			start = function (evt) {
				btn = evt.button;
				evt.target.removeEventListener('mousedown', this[mouseListener]);
				evt.target.addEventListener('mousemove', mousemove);
				evt.target.addEventListener('mouseup', mouseup);
			}.bind(this),
			mouseup = function (evt) {
				if (evt.button === btn) {
					evt.target.style.cursor = 'default';
					evt.target.removeEventListener('mousemove', mousemove);
					evt.target.removeEventListener('mouseup', mouseup);
					evt.target.addEventListener('mousedown', this[mouseListener]);
				}
			}.bind(this);
		if (evt.button === 0) {
			let fireX = evt.offsetX;
			mousemove = function (evt) {
				let x = (fireX - evt.offsetX) % (this[canvas3d].clientWidth / (this[end] - this[begin]));
				if (this.moveCoordBy(Math.round((fireX - evt.offsetX - x) * (this[end] - this[begin]) / this[canvas3d].clientWidth))) {
					fireX = evt.offsetX - x;
				}
			}.bind(this);
			evt.target.style.cursor = 'move';
			start(evt);
		} else if (evt.button === 2 && !this.fixed) {
			mousemove = function (evt) {
				changeCursor.call(this, Math.min(Math.max(Math.round(this[begin] + evt.offsetX * (this[end] - this[begin]) / this[canvas3d].clientWidth), this[begin]), this[end]));
			}.bind(this);
			evt.target.style.cursor = 'crosshair';
			start(evt);
			mousemove(evt);
		}
	}

	function wheel(evt) {
		let absx = Math.abs(evt.deltaX),
			absy = Math.abs(evt.deltaY);
		evt.preventDefault();
		if (absx > absy) {
			if (evt.altKey && !this.fixed) {
				this.moveCursorBy(evt.deltaX);
			} else {
				this.moveCoordBy(Math.round(evt.deltaX));
			}
		} else if (absy > absx) {
			this.zoomCoordBy(evt.deltaY, !evt.altKey);
		}
	}

	function keydown(evt) {
		let result;
		if (evt.keyCode == 37) {
			result = evt.altKey ? this.moveCursorBy(-1) : this.moveCoordBy(1);
		} else if (evt.keyCode == 39) {
			result = evt.altKey ? this.moveCursorBy(1) : this.moveCoordBy(-1);
		} else if (evt.keyCode == 38) {
			result = this.zoomCoordBy(-1, evt.altKey);
		} else if (evt.keyCode == 40) {
			result = this.zoomCoordBy(1, evt.altKey);
		}
		if (result) {
			evt.preventDefault();
		}
	}
}();
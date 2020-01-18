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
		coord = Symbol('coord'),
		color = Symbol('color'),
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
		workers = [],
		queue = [],
		callbacks = {};

	let reqid = 0;
	for (let i = 0; i < (navigator.hardwareConcurrency || 4) - 1; i++) {
		workers[i] = new Worker('chart_service.js');
		workers[i].addEventListener('message', workerMessage);
	}

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
			preserveDrawingBuffer: true
		});
		this[gl].enable(this[gl].DEPTH_TEST);
		let vertShader = this[gl].createShader(this[gl].VERTEX_SHADER),
			fragShader = this[gl].createShader(this[gl].FRAGMENT_SHADER),
			shaderProgram = this[gl].createProgram();
		this[gl].shaderSource(vertShader, 'attribute vec3 coordinates;void main(void){gl_Position=vec4(coordinates,1);}');
		this[gl].shaderSource(fragShader, 'precision highp float;uniform vec4 fgcolor;void main(void){gl_FragColor=vec4(fgcolor);}');
		this[gl].compileShader(vertShader);
		this[gl].compileShader(fragShader);
		this[gl].attachShader(shaderProgram, vertShader);
		this[gl].attachShader(shaderProgram, fragShader);
		this[gl].linkProgram(shaderProgram);
		this[gl].useProgram(shaderProgram);
		this[coord] = this[gl].getAttribLocation(shaderProgram, 'coordinates');
		this[color] = this[gl].getUniformLocation(shaderProgram, 'fgcolor');
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
		if (this[paiting]) {
			this[paiting] = 2;
			this[queueActions].push(data);
		} else {
			addLines.call(this, data);
			buildIndex.call(this);
			return true;
		}
	};

	Chart.prototype.remove = function (names) {
		if (this[paiting]) {
			this[paiting] = 2;
			this[queueActions].push(names);
		} else if (removeLines.call(this, names)) {
			buildIndex.call(this);
			return true;
		}
	};

	Chart.prototype.setSections = function (sections) {
		let refresh;
		for (let c in sections) {
			if (this[lines].hasOwnProperty(c)) {
				let data = new Float32Array(this[lines][c].data),
					idx = Object.keys(sections[c]).sort(this[sorting]);
				this[lines][c].sectionStarts = [];
				this[lines][c].colors = [];
				for (let i = 0; i < idx.length; i++) {
					if (this.indexOrder.hasOwnProperty(idx[i]) && !Number.isNaN(data[this.indexOrder[idx[i]]])) {
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
			this[oldbegin] = this[begin];
			this[oldend] = this[end];
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
			this[oldbegin] = this[begin];
			this[oldend] = this[end];
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
			if (this[lines][c].data) {
				let oldSource = {},
					data = new Float32Array(this[lines][c].data);
				for (let i = this[lines][c].first; i <= this[lines][c].last; i++) {
					if (!Number.isNaN(data[i])) {
						oldSource[this.index[i]] = data[i];
					}
				}
				this[lines][c].source = Object.assign(oldSource, this[lines][c].source);
			}
			for (let n in this[lines][c].source) {
				if (this[lines][c].source[n] > 0) {
					this.indexOrder[n] = 0;
				}
			}
		}
		this.index = Object.keys(this.indexOrder).sort(this[sorting]);
		for (let i = 0; i < this.index.length; i++) {
			this.indexOrder[this.index[i]] = i;
		}
		let len = this.index.length * Float32Array.BYTES_PER_ELEMENT;
		for (let c in this[lines]) {
			this[lines][c].first = this[lines][c].last = NaN;
			this[lines][c].tmin = Infinity;
			this[lines][c].tmax = -Infinity;
			if (!this[lines][c].data || this[lines][c].data.byteLength !== len) {
				this[lines][c].data = new ArrayBuffer(len);
			}
			let data = new Float32Array(this[lines][c].data);
			for (let i = 0; i < data.length; i++) {
				if (this[lines][c].source[this.index[i]] > 0) {
					data[i] = this[lines][c].source[this.index[i]];
					if (Number.isNaN(this[lines][c].first)) {
						this[lines][c].first = i;
					}
					this[lines][c].last = i;
					if (this[lines][c].tmax < data[i]) {
						this[lines][c].tmax = data[i];
						this[lines][c].tmaxi = i;
					}
					if (this[lines][c].tmin > data[i]) {
						this[lines][c].tmin = data[i];
						this[lines][c].tmini = i;
					}
				} else {
					data[i] = NaN;
				}
			}
			delete this[lines][c].source;
		}
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
			this[oldbegin] = this[begin];
			this[oldend] = this[end];
			this[begin] = range[0];
			this[end] = range[1];
			this[rangeChange] = true;
			draw.call(this);
			return true;
		}
	}

	function checkCursor(cur) {
		return this.index.length ? Math.max(Math.min(cur, this.index.length - 1), 0) : NaN;
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
		if (this[paiting]) {
			this[paiting] = 2;
		} else {
			let fireRangeChange = this[rangeChange],
				fireCursorChange = this[cursorChange];
			this[paiting] = 1;
			if (this.onpaitbegin) {
				this.onpaitbegin({
					type: 'paitbegin'
				});
			}
			this[ground].clearRect(0, 0, this[canvas2d].clientWidth, this[canvas2d].clientHeight);
			this[ground].font = this[fontSize] + 'px monospace';
			this[gl].clearColor(this[backgroundColor][0], this[backgroundColor][1], this[backgroundColor][2], 1);
			this[gl].clear(this[gl].COLOR_BUFFER_BIT | this[gl].DEPTH_BUFFER_BIT | this[gl].STENCIL_BUFFER_BIT);
			this[gl].uniform4f(this[color], this[rectColor][0], this[rectColor][1], this[rectColor][2], 1);
			let buf = new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT * 8);
			new Float32Array(buf).set([-1, -1, -1, 1, 1, 1, 1, -1]);
			drawPolyline.call(this, buf, true);
			if (this.index.length > 1) {
				if (fireRangeChange) {
					for (let c in this[lines]) {
						let bg = Math.max(this[begin], this[lines][c].first),
							ed = Math.min(this[end], this[lines][c].last),
							obg = Math.max(this[oldbegin], this[lines][c].first),
							oed = Math.min(this[oldend], this[lines][c].last),
							data = new Float32Array(this[lines][c].data);
						if (this[lines][c].first < bg && this[lines][c].last > bg) {
							while (Number.isNaN(data[bg])) {
								bg--;
							}
						}
						if (this[lines][c].first < obg && this[lines][c].last > obg) {
							while (Number.isNaN(data[obg])) {
								obg--;
							}
						}
						if (bg !== obg || ed !== oed) {
							if (this[lines][c].first < ed && this[lines][c].last > bg) {
								let findmax, findmin;
								if (this[lines][c].tmaxi >= bg && this[lines][c].tmaxi <= ed) {
									this[lines][c].max = this[lines][c].tmax;
									this[lines][c].maxi = this[lines][c].tmaxi;
								} else {
									findmax = true;
								}
								if (this[lines][c].tmini >= bg && this[lines][c].tmini <= ed) {
									this[lines][c].min = this[lines][c].tmin;
									this[lines][c].mini = this[lines][c].tmini;
								} else {
									findmin = true;
								}
								if (findmax || findmin) {
									if (bg > obg && ed < oed) {
										if (findmax && (this[lines][c].maxi < bg || this[lines][c].maxi > ed)) {
											this[lines][c].max = -Infinity;
										}
										if (findmin && (this[lines][c].mini < bg || this[lines][c].mini > ed)) {
											this[lines][c].min = Infinity;
										}
									} else if (bg > obg && bg < oed) {
										if (findmax && this[lines][c].maxi < bg) {
											this[lines][c].max = -Infinity;
										}
										if (findmin && this[lines][c].mini < bg) {
											this[lines][c].min = Infinity;
										}
										findMaxMin.call(this, oed + 1, ed, findmax && this[lines][c].max !== -Infinity, findmin && this[lines][c].min !== Infinity);
									} else if (ed > obg && ed < oed) {
										if (findmax && this[lines][c].maxi > ed) {
											this[lines][c].max = -Infinity;
										}
										if (findmin && this[lines][c].mini > ed) {
											this[lines][c].min = Infinity;
										}
										findMaxMin.call(this, bg, obg - 1, findmax && this[lines][c].max !== -Infinity, findmin && this[lines][c].min !== Infinity);
									} else if (bg <= obg && ed >= oed) {
										findMaxMin.call(this, bg, obg - 1, findmax, findmin);
										findMaxMin.call(this, oed + 1, ed, findmax, findmin);
									} else {
										if (findmax) {
											this[lines][c].max = -Infinity;
										}
										if (findmin) {
											this[lines][c].min = Infinity;
										}
									}
									findMaxMin.call(this, bg, ed, this[lines][c].max === -Infinity, this[lines][c].min === Infinity);
								}
							} else {
								this[lines][c].max = -Infinity;
								this[lines][c].min = Infinity;
								this[lines][c].maxi = this[lines][c].mini = NaN;
							}
						}

						function findMaxMin(bg, ed, findmax, findmin) {
							if (findmax && findmin) {
								for (let i = bg; i <= ed; i++) {
									if (!Number.isNaN(data[i])) {
										checkMax.call(this, i);
										checkMin.call(this, i);
									}
								}
							} else if (findmax) {
								for (let i = bg; i <= ed; i++) {
									if (!Number.isNaN(data[i])) {
										checkMax.call(this, i);
									}
								}
							} else if (findmin) {
								for (let i = bg; i <= ed; i++) {
									if (!Number.isNaN(data[i])) {
										checkMin.call(this, i);
									}
								}
							}
				
							function checkMax(i) {
								if (this[lines][c].max < data[i]) {
									this[lines][c].max = data[i];
									this[lines][c].maxi = i;
								}
							}
					
							function checkMin(i) {
								if (this[lines][c].min > data[i]) {
									this[lines][c].min = data[i];
									this[lines][c].mini = i;
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
						if (this[lines][c].first < this[end] && this[lines][c].last > this[begin]) {
							let data = new Float32Array(this[lines][c].data);
							if (!Number.isNaN(data[this[cursor]])) {
								this[lines][c].base = data[this[cursor]];
							} else if (this[lines][c].first > this[cursor]) {
								this[lines][c].base = data[this[lines][c].first];
							} else if (this[lines][c].last < this[cursor]) {
								this[lines][c].base = data[this[lines][c].last];
							} else {
								let i = this[cursor] - 1;
								while (Number.isNaN(data[i])) {
									i--;
								}
								this[lines][c].base = data[i];
							}
							let maxv = (this[lines][c].max - this[lines][c].base) / this[lines][c].base,
								minv = (this[lines][c].min - this[lines][c].base) / this[lines][c].base;
							if (this[max] < maxv) {
								this[max] = maxv;
							}
							if (this[min] > minv) {
								this[min] = minv;
							}
						}
					}
					this[cursorChange] = false;
					doFire.call(this);
				}
				let w = this[canvas3d].clientWidth,
					h = this[canvas3d].clientHeight,
					wv = this[end] - this[begin],
					hv = this[max] - this[min],
					wu = w / wv,
					hu = this[max] / hv,
					n = Math.ceil(this[paddingX] * wv / w),
					m = Math.floor(hu * h / this[paddingY]),
					k = Math.floor((1 - hu) * h / this[paddingY]),
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
						pushx.call(this, xys, xtxts, wu, wv, this[cursor] + Math.round(i * n2));
					}
					n1 = Math.floor((this[cursor] - this[begin]) / n);
					n2 = (this[cursor] - this[begin]) / n1;
					for (let i = 1; i < n1; i++) {
						pushx.call(this, xys, xtxts, wu, wv, this[cursor] - Math.round(i * n2));
					}
					let x = this[cursor] - this[begin];
					curs.push({
						x: x * 2 / wv - 1
					});
					xtxts.push({
						v: x * wu + this[paddingLeft],
						text: this[xLableing] ? this[xLableing](this.index[this[cursor]]) : this.index[this[cursor]]
					});
				} else {
					let n1 = Math.floor((this[end] - this[begin]) / n),
						n2 = (this[end] - this[begin]) / n1;
					for (let i = 1; i < n1; i++) {
						pushx.call(this, xys, xtxts, wu, wv, this[cursor] < this[begin] ? this[begin] + Math.round(i * n2) : this[end] - Math.round(i * n2));
					}
				}
				curs.push({
					y: hu
				});
				ytxts.push({
					v: this[fontSize] / 2,
					text: Math.round(this[max] * 1000) / 10 + '%'
				});
				ytxts.push({
					v: h + this[fontSize] / 2,
					text: Math.round(this[min] * 1000) / 10 + '%'
				});
				for (let i = 1; i < m; i++) {
					pushy.call(this, xys, ytxts, h, hu - hu * i / m, this[max] * i / m);
				}
				for (let i = 1; i < k; i++) {
					pushy.call(this, xys, ytxts, h, hu + (1 - hu) * i / k, this[min] * i / k);
				}
				ytxts.push({
					v: hu * h + this[fontSize] / 2,
					text: '0%'
				});
				drawText.call(this, xtxts, h + this[fontSize]);
				drawText.call(this, ytxts);
				this[gl].uniform4f(this[color], this[cursorColor][0], this[cursorColor][1], this[cursorColor][2], 1);
				drawxy.call(this, curs);
				this[gl].uniform4f(this[color], this[gridColor][0], this[gridColor][1], this[gridColor][2], 1);
				drawxy.call(this, xys);
				if (this[selected] && this[lines][this[selected]].first < this[end] && this[lines][this[selected]].last > this[begin]) {
					let sectionStarts = [this[begin]],
						colors = [];
					if (this[lines][this[selected]].sectionStarts) {
						let bg = Math.max(this[begin], this[lines][this[selected]].first);
						for (let i = 0; i < this[lines][this[selected]].sectionStarts.length; i++) {
							if (this[lines][this[selected]].sectionStarts[i] <= bg) {
								colors[0] = this[lines][this[selected]].colors[i];
							} else if (this[lines][this[selected]].sectionStarts[i] < this[end]) {
								sectionStarts.push(this[lines][this[selected]].sectionStarts[i]);
								colors.push(this[lines][this[selected]].colors[i]);
							} else {
								break;
							}
						}
						if (colors.length === 0) {
							colors[0] = this[lines][this[selected]].colors[0];
						}
					} else {
						colors = [this[selectedColor]];
					}
					queueWork({
						api: 'buildLine',
						param: {
							name: this[selected],
							data: this[lines][this[selected]].data,
							w: w,
							wu: wu,
							hv: hv,
							first: this[lines][this[selected]].first,
							last: this[lines][this[selected]].last,
							begin: this[begin],
							end: this[end],
							max: this[max],
							base: this[lines][this[selected]].base,
							sectionStarts: sectionStarts
						},
						transfer: [this[lines][this[selected]].data],
						callback: function (result) {
							this[lines][result.name].data = result.data;
							if (this[paiting] === 2) {
								stepFinal.call(this);
							} else {
								for (let i = 0; i < result.sections.length; i++) {
									this[gl].uniform4f(this[color], colors[i][0], colors[i][1], colors[i][2], 1);
									drawPolyline.call(this, result.sections[i].points, false, result.sections[i].length);
								}
								step2.call(this);
							}
						},
						this: this
					});
				} else {
					step2.call(this);
				}

				function step2() {
					let i = 0,
						works = [];
					for (let c in this[lines]) {
						if (c !== this[selected] && this[lines][c].first < this[end] && this[lines][c].last > this[begin]) {
							let work = {
								api: 'buildLine',
								param: {
									name: c,
									data: this[lines][c].data,
									w: w,
									wu: wu,
									hv: hv,
									first: this[lines][c].first,
									last: this[lines][c].last,
									begin: this[begin],
									end: this[end],
									max: this[max],
									base: this[lines][c].base
								},
								transfer: [this[lines][c].data],
								callback: workDone,
								this: this
							};
							if (queueWork(work)) {
								works.push(work);
							}
							i++;
						}
					}
					if (i > 0) {
						this[gl].uniform4f(this[color], this[lineColor][0], this[lineColor][1], this[lineColor][2], 1);
					} else {
						stepFinal.call(this);
					}

					function workDone(result) {
						this[lines][result.name].data = result.data;
						if (this[paiting] !== 2) {
							drawPolyline.call(this, result.sections[0].points, false, result.sections[0].length);
						} else if (works) {
							for (let j = 0; j < works.length; j++) {
								if (cancelWork(works[j])) {
									i--;
								}
							}
							works = undefined;
						}
						i--;
						if (i === 0) {
							stepFinal.call(this);
						}
					}
				}
			} else {
				doFire.call(this);
				stepFinal.call(this);
			}

			function doFire() {
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

			function stepFinal() {
				let rebuildIndex,
					canceled = this[paiting] === 2;
				this[paiting] = 0;
				if (canceled) {
					if (this.onpaitcancel) {
						this.onpaitcancel({
							type: 'paitcancel'
						});
					}
				} else if (this.onpaitend) {
					this.onpaitend({
						type: 'paitend'
					});
				}
				while (this[queueActions].length) {
					let act = this[queueActions].shift();
					if (Array.isArray(act)) {
						if (removeLines.call(this, act)) {
							rebuildIndex = true;
						}
					} else {
						addLines.call(this, act);
						rebuildIndex = true;
					}
				}
				if (rebuildIndex) {
					buildIndex.call(this);
				} else if (canceled) {
					draw.call(this);
				}
			}
		}
	}

	function pushx(xys, xtxts, wu, wv, i) {
		let x = i - this[begin];
		xys.push({
			x: x * 2 / wv - 1
		});
		xtxts.push({
			v: x * wu + this[paddingLeft],
			text: this[xLableing] ? this[xLableing](this.index[i]) : this.index[i]
		});
	}

	function pushy(xys, ytxts, h, y, v) {
		xys.push({
			y: y
		});
		ytxts.push({
			v: y * h + this[fontSize] / 2,
			text: Math.round(v * 1000) / 10 + '%'
		});
	}

	function drawxy(pos) {
		let buf = new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT * 4),
			a = new Float32Array(buf);
		for (let i = 0; i < pos.length; i++) {
			if (pos[i].hasOwnProperty('x')) {
				a[0] = a[2] = pos[i].x;
				a[1] = -1;
				a[3] = 1;
			} else {
				a[1] = a[3] = pos[i].y * -2 + 1;
				a[0] = -1;
				a[2] = 1;
			}
			drawPolyline.call(this, buf);
		}
	}

	function drawText(pos, y) {
		if (y === undefined) {
			let x = this[paddingLeft] - this[fontSize] / 2;
			this[ground].textAlign = 'right';
			this[ground].textBaseline = 'middle';
			this[ground].fillStyle = translateColor(this[textColor]);
			for (let i = 0; i < pos.length; i++) {
				if (i === pos.length - 1) {
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

	function translateColor(c) {
		return 'rgb(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ')';
	}

	function drawPolyline(vertices, close, length) {
		let vertex_buffer = this[gl].createBuffer();
		this[gl].bindBuffer(this[gl].ARRAY_BUFFER, vertex_buffer);
		this[gl].bufferData(this[gl].ARRAY_BUFFER, vertices, this[gl].STREAM_DRAW);
		this[gl].vertexAttribPointer(this[coord], 2, this[gl].FLOAT, false, 0, 0);
		this[gl].enableVertexAttribArray(this[coord]);
		this[gl].drawArrays(close ? this[gl].LINE_LOOP : this[gl].LINE_STRIP, 0, (length ? length : vertices.byteLength / Float32Array.BYTES_PER_ELEMENT) / 2);
	}

	function addLines(data) {
		for (let c in data) {
			if (!this[lines][c]) {
				this[lines][c] = {};
			}
			this[lines][c].source = data[c];
		}
	}

	function removeLines(names) {
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
		}
		return removed;
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
			this.zoomCoordBy(evt.deltaY, evt.altKey);
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

	function workerMessage(evt) {
		callbacks[evt.data.id].callback.call(callbacks[evt.data.id].this, evt.data.result);
		delete callbacks[evt.data.id];
		if (queue.length) {
			doPostMessage(this, queue.shift());
		} else {
			this.working = false;
		}
	}

	function queueWork(work) {
		for (let i = 0; i < workers.length; i++) {
			if (!workers[i].working) {
				doPostMessage(workers[i], work);
				return;
			}
		}
		queue.push(work);
		return true;
	}

	function cancelWork(work) {
		let i = queue.indexOf(work);
		if (i >= 0) {
			queue.splice(i, 1);
			return true;
		}
	}

	function doPostMessage(worker, work) {
		let id = reqid++;
		callbacks[id] = {
			callback: work.callback,
			this: work.this
		};
		worker.postMessage({
			id: id,
			api: work.api,
			param: work.param
		}, work.transfer);
		worker.working = true;
	}
}();
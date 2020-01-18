'use strict';

let apis = {
	buildLine: function (o) {
		let data = new Float32Array(o.data),
			r = {
				result: {
					name: o.name,
					sections: [],
					data: o.data
				},
				transfer: [o.data]
			};
		if (o.sectionStarts) {
			for (let i = 0; i < o.sectionStarts.length; i++) {
				r.result.sections[i] = addSection(o.sectionStarts[i], i === o.sectionStarts.length - 1 ? o.end : o.sectionStarts[i + 1], o.sectionStarts[i] - o.begin);
				r.transfer.push(r.result.sections[i].points);
			}
		} else {
			r.result.sections[0] = addSection(o.begin, o.end, 0);
			r.transfer.push(r.result.sections[0].points);
		}
		return r;

		function addSection(begin, end, offset) {
			let maxv, minv, first, last, lx,
				bg = Math.max(begin, o.first),
				ed = Math.min(end, o.last),
				l = ed - bg + 1,
				points = new Float32Array(new ArrayBuffer(Math.min(l, Math.round(o.w * l / (o.end - o.begin + 1)) * 4) * 2 * Float32Array.BYTES_PER_ELEMENT)),
				pos = 0;
			for (let i = bg; i <= end; i++) {
				if (!Number.isNaN(data[i]) || (o.first < i && o.last > i)) {
					let j = i;
					while (Number.isNaN(data[j])) {
						j--;
					}
					let x = Math.round((i - begin + offset) * o.wu),
						y = (data[j] - o.base) / o.base - o.max;
					if (lx === x) {
						if (maxv < y) {
							maxv = y;
						} else if (minv > y) {
							minv = y;
						}
						last = y;
					} else {
						if (lx !== undefined) {
							addPoints();
						}
						lx = x;
						first = last = maxv = minv = y;
					}
				}
			}
			addPoints();
			return {
				points: points.buffer,
				length: pos
			};

			function addPoints() {
				addPoint(lx, first);
				if (maxv !== minv) {
					if (first === maxv) {
						addPoint(lx, minv);
						if (last !== minv) {
							addPoint(lx, last);
						}
					} else if (first === minv) {
						addPoint(lx, maxv);
						if (last !== maxv) {
							addPoint(lx, last);
						}
					} else {
						if (last === minv) {
							addPoint(lx, maxv);
							addPoint(lx, minv);
						} else if (last === maxv) {
							addPoint(lx, minv);
							addPoint(lx, maxv);
						} else {
							addPoint(lx, maxv);
							addPoint(lx, minv);
							addPoint(lx, last);
						}
					}
				}
			}

			function addPoint(x, y) {
				points[pos++] = x * 2 / o.w - 1;
				points[pos++] = y * 2 / o.hv + 1;
			}
		}
	}
};

addEventListener('message', function (evt) {
	if (apis.hasOwnProperty(evt.data.api)) {
		let result = apis[evt.data.api](evt.data.param);
		postMessage({
			result: result.result,
			id: evt.data.id
		}, result.transfer);
	} else {
		postMessage({
			id: evt.data.id
		});
	}
});
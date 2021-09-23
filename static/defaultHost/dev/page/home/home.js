'use strict';
define(['module', 'common/kernel/kernel', 'common/chart/chart'], function (module, kernel, Chart) {
	let thisPage = module.id.replace(/^[^/]+\/|\/[^/]+/g, ''),
		dom = document.querySelector('#page>.' + thisPage),
		chart = new Chart(dom.querySelector('.chart'), true),
		subchart = new Chart(dom.querySelector('.subchart')),
		list = dom.querySelector('.list'),
		url = 'https://trade.tinysoft.com.cn/webapi/api2.tsl',
		cross, data;
	chart.paddingLeft = subchart.paddingLeft = 60;
	list.addEventListener('keydown', function (evt) {
		let el;
		if (evt.keyCode === 38 || evt.keyCode === 40) {
			evt.preventDefault();
			if (chart.selected) {
				el = list.querySelector(`a[data-id="${chart.selected}"]`);
			}
			if (el) {
				if (evt.keyCode === 38) {
					el = el === list.firstChild ? list.lastChild : el.previousSibling;
				} else {
					el = el === list.lastChild ? list.firstChild : el.nextSibling;
				}
			} else {
				el = list.firstChild;
			}
			if (el) {
				el.scrollIntoView();
				el.click();
			}
		}
	});
	list.addEventListener('click', function (evt) {
		if (evt.target.nodeName === 'A') {
			if (chart.selected === evt.target.dataset.id) {
				chart.selected = undefined;
				evt.target.style.fontWeight = '';
			} else {
				let el = list.querySelector(`a[data-id="${chart.selected}"]`);
				if (el) {
					el.style.fontWeight = '';
				}
				evt.target.style.fontWeight = 'bold';
				chart.selected = evt.target.dataset.id;
			}
		}
	});
	return {
		onload: function (force) {
			if (force) {

			}
			kernel.showLoading();
			Promise.all([fetch(url, {
				method: 'post',
				body: 'ServiceID=Z002'
			}).then(function(response) {
				return response.json();
			}), fetch(url, {
				method: 'post',
				body: 'ServiceID=Z003&param=[' + encodeURIComponent('"A股"') + ']'
			}).then(function (response) {
				return response.json();
			}).then(function (json) {
				let stocks = json.Result;
				return caches.open('chart').then(function(cache) {
					return cache.match('/data').then(function(response) {
						if (response) {
							return response.json().then(function(data) {
								return fetch(url, {
									method: 'post',
									body: 'ServiceID=Z001&param=["' + Object.keys(stocks).join(';') + '",' + data.days[data.days.length - 1] + ']'
								}).then(function (response) {
									return response.json();
								}).then(function (json) {
									for (let i = 1; i < json.Result.length; i++) {
										if (i > 1) {
											data.days.push(json.Result[i][0]);
										}
										for (let j = 1; j < json.Result[i].length; j++) {
											if (json.Result[i][j] !== null) {
												if (!data.base[json.Result[0][j]]) {
													data.base[json.Result[0][j]] = [stocks[json.Result[0][j]], data.days.length - 1];
												}
												if (i === 1 && data.base[json.Result[0][j]].length > 2) {
													data.base[json.Result[0][j]].splice(-1, 1, json.Result[i][j]);
												} else {
													data.base[json.Result[0][j]].push(json.Result[i][j]);
												}
											}
										}
									}
									if (json.Result.length > 2) {
										cache.put('/data', new Response(JSON.stringify(data)));
									}
									//json.Result = null;
									return data;
								});
							});
						} else {
							return fetch(url, {
								method: 'post',
								body: 'ServiceID=Z001&param=["' + Object.keys(stocks).join(';') + '"]'
							}).then(function (response) {
								return response.json();
							}).then(function (json) {
								let data = {
									days: [],
									base: {}
								};
								for (let i = 1; i < json.Result.length; i++) {
									for (let j = 1; j < json.Result[i].length; j++) {
										if (json.Result[i][j] !== null) {
											if (!data.base[json.Result[0][j]]) {
												data.base[json.Result[0][j]] = [stocks[json.Result[0][j]], data.days.length];
											}
											data.base[json.Result[0][j]].push(json.Result[i][j]);
										}
									}
									data.days.push(json.Result[i][0]);
								}
								cache.put('/data', new Response(JSON.stringify(data)));
								//json.Result = null;
								return data;
							});
						}
					});
				});
			})]).then(function(jsons) {
				let cross = jsons[0].Result,
					data = jsons[1],
					lines = {},
					sections = {},
					misc = {},
					colors = [
						[0.25, 0.75, 0.25],
						[0.25, 0.25, 0.25],
						[0.75, 0.25, 0.25]
					];
				for (let n in cross) {
					if (data.base[n]) {
						let j = data.days.indexOf(cross[n][0]);
						if (j >= 0) {
							misc[n] = [];
							lines[n] = {
								data: [],
								cross: j - data.base[n][1]
							};
							sections[n] = {
								starts: [],
								colors: []
							};
							for (let i = 2; i < data.base[n].length; i++) {
								if (misc[n][0] !== data.base[n][i][3]) {
									misc[n][0] = data.base[n][i][3];
									sections[n].starts.push(lines[n].data.length);
									sections[n].colors.push(colors[data.base[n][i][3]]);
								}
								misc[n][1] = data.base[n][i][2];
								lines[n].data.push(data.base[n][i][0] * data.base[n][i][1]);
							}
						}
					}
					//data.base[n] = data.base[n][0];
				}
				chart.add(lines);
				chart.setSections(sections);
				chart.center();
				let keys = Object.keys(misc).sort(function (a, b) {
					return misc[b][1] - misc[a][1];
				});
				let s = '';
				for (let i = 0; i < keys.length; i++) {
					s += `<a data-id="${keys[i]}"><span class="name">${data.base[keys[i]][0]}</span><span class="progress c${misc[keys[i]][0]}"><span style="width: ${misc[keys[i]][1] * 100}%"></span></span></a>`;
				}
				list.innerHTML = s;
				kernel.hideLoading();
			});
		}
	};

	function translateColor(v) {
		return 'rgb(' + calc(v) + ',' + calc(v > 0.5 ? 1 - v : v) + ',' +  calc(1 - v) + ')';

		function calc(n) {
			return Math.round(n * 255);
		}
	}
});
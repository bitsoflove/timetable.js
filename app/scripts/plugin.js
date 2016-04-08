/*jshint -W079*/

'use strict';

var Timetable = function(options) {
	this.scope = {
		start: Infinity,
		end: -Infinity,
		hourStart: 24,
		hourEnd: 0,
		hourMargin: options.margin || 0
	};
	this.locations = [];
	this.events = [];
};

Timetable.Renderer = function(tt) {
	if (!(tt instanceof Timetable)) {
		throw new Error('Initialize renderer using a Timetable');
	}
	this.timetable = tt;
};

(function() {
	function isValidHourRange(start, end) {
		return isValidHour(start) && isValidHour(end);
	}
	function isValidHour(number) {
		return isInt(number) && isInHourRange(number);
	}
	function isInt(number) {
		return number === parseInt(number, 10);
	}
	function isInHourRange(number) {
		return number >= 0 && number < 24;
	}
	function locationExistsIn(loc, locs) {
		return locs.indexOf(loc) !== -1;
	}
	function isValidTimeRange(start, end) {
		var correctTypes = start instanceof Date && end instanceof Date;
		var correctOrder = start < end;
		return correctTypes && correctOrder;
	}

	Timetable.prototype = {
		addLocations: function(newLocations) {
			function hasProperFormat() {
				return newLocations instanceof Array;
			}

			var existingLocations = this.locations;

			if (hasProperFormat()) {
				newLocations.forEach(function(loc) {
					if (!locationExistsIn(loc, existingLocations)) {
						existingLocations.push(loc);
					} else {
						throw new Error('Location already exists');
					}
				});
			} else {
				throw new Error('Tried to add locations in wrong format');
			}

			return this;
		},
		addEvent: function(name, location, start, end, url, className) {
			if (!locationExistsIn(location, this.locations)) {
				throw new Error('Unknown location');
			}
			if (!isValidTimeRange(start, end)) {
				throw new Error('Invalid time range: ' + JSON.stringify([start, end]));
			}


			if (this.scope.start > start) {
				this.scope.hourStart = start.getHours() - this.scope.hourMargin;
			}
			if (this.scope.end < end) {
				this.scope.hourEnd = end.getHours() + (end.getMinutes() > 0 ? 1 : 0) + this.scope.hourMargin;
			}

			this.scope.start = Math.min(this.scope.start, start);
			this.scope.end = Math.max(this.scope.end, end);

			this.events.push({
				name: name,
				location: location,
				startDate: start,
				endDate: end,
				url: url,
                className: className
			});

			return this;
		}
	};

	function emptyNode(node) {
		while (node.firstChild) {
			node.removeChild(node.firstChild);
		}
	}

	function prettyFormatHour(hour) {
		var prefix = hour < 10 ? '0' : '';
		return prefix + hour + ':00';
	}

	Timetable.Renderer.prototype = {
		draw: function(selector, rowHeight) {
			function getScopeDurationHours(startHour, endHour) {
				return endHour > startHour ? endHour - startHour : 24 + endHour - startHour;
			}
			function checkContainerPrecondition(container) {
				if (container === null) {
					throw new Error('Timetable container not found');
				}
			}
			function appendTimetableAside(container) {
				var asideNode = container.appendChild(document.createElement('aside'));
				var asideULNode = asideNode.appendChild(document.createElement('ul'));
				appendRowHeaders(asideULNode);
			}
			function appendRowHeaders(ulNode) {
				for (var k=0; k<timetable.locations.length; k++) {
					var liNode = ulNode.appendChild(document.createElement('li'));
					var spanNode = liNode.appendChild(document.createElement('span'));
					var subRowCount = timetable.rows[k].subRows.length != 0 ? timetable.rows[k].subRows.length : 1;

					liNode.style.height = rowHeight * subRowCount + "px";
					liNode.style.lineHeight = rowHeight * subRowCount + "px";
					spanNode.className = 'row-heading';
					spanNode.textContent = timetable.locations[k];
				}
			}
			function appendTimetableSection(container) {
				var sectionNode = container.appendChild(document.createElement('section'));
				var timeNode = sectionNode.appendChild(document.createElement('time'));
				appendColumnHeaders(timeNode);
				appendTimeRows(timeNode);
			}
			function appendColumnHeaders(node) {
				var headerNode = node.appendChild(document.createElement('header'));
				var headerULNode = headerNode.appendChild(document.createElement('ul'));

				var completed = false;
				var looped = false;

				for (var hour=timetable.scope.hourStart; !completed;) {
					var liNode = headerULNode.appendChild(document.createElement('li'));
					var spanNode = liNode.appendChild(document.createElement('span'));
					spanNode.className = 'time-label';
					spanNode.textContent = prettyFormatHour(hour);

					if (hour === timetable.scope.hourEnd && (timetable.scope.hourStart !== timetable.scope.hourEnd || looped)) {
						completed = true;
					}
					if (++hour === 24) {
						hour = 0;
						looped = true;
					}
				}
			}
			function appendTimeRows(node) {
				var ulNode = node.appendChild(document.createElement('ul'));
				ulNode.className = 'room-timeline';
				for (var k=0; k<timetable.locations.length; k++) {
					var subRowCount = timetable.rows[k].subRows.length != 0 ? timetable.rows[k].subRows.length : 1;
					var liNode = ulNode.appendChild(document.createElement('li'));

					liNode.style.height = rowHeight * subRowCount + "px";
					appendLocationEvents(timetable.locations[k], liNode);/**/
				}
			}
			function appendLocationEvents(location, node) {
				for (var k=0; k<timetable.events.length; k++) {
					var event = timetable.events[k];
					if (event.location === location) {
						appendEvent(event, node);
					}
				}
			}
			function appendEvent(event, node) {
				var hasURL = event.url;
				var elementType = hasURL ? 'a' : 'span';
				var aNode = node.appendChild(document.createElement(elementType));
				var smallNode = aNode.appendChild(document.createElement('small'));
				aNode.title = event.name;
				if (hasURL) {
					aNode.href = event.url;
				}
				aNode.className = 'time-entry' + (event.className ? ' ' + event.className : '');
				aNode.style.top = event.subRowIndex * rowHeight + "px";
				aNode.style.width = computeEventBlockWidth(event);
				aNode.style.left = computeEventBlockOffset(event);
				smallNode.textContent = event.name;
			}
			function computeEventBlockWidth(event) {
				var start = event.startDate;
				var end = event.endDate;
				var durationHours = computeDurationInHours(start, end);
				return durationHours / scopeDurationHours * 100 + '%';
			}
			function computeDurationInHours(start, end) {
				return (end.getTime() - start.getTime()) / 1000 / 60 / 60;
			}
			function computeEventBlockOffset(event) {
				var start = event.startDate;
				var startHours = start.getHours() + (start.getMinutes() / 60);
				return (startHours - timetable.scope.hourStart) / scopeDurationHours * 100 + '%';
			}

			function computeSubRowData(data) {
			    var locations = {};

			    data.locations.map(function(location, i) {locations[location] = {index: i, rows: []}})

			    data.events.map(function(event) {
			        var start = event.startDate;
			        var end = event.endDate;

			        var location = locations[event.location];
			        event.rowIndex = location.index;

			        var rows = location.rows;

			        var rowWithRoom = null;
			        for (var i = 0; i < rows.length; i++) {
			            var row = rows[i];
			            for (var j = 0; j < row.length; j++) {
			                var eventInRow = row[j];
			                if (start < eventInRow.end && end > eventInRow.start) {
			                    rowWithRoom = null;
			                    break;
			                } else {
			                    rowWithRoom = {row: row, index: i};
			                }
			            }
			            if (rowWithRoom) {
			                break;
			            }
			        }

			        var newEvent = {event: event, start: start, end: end};
			        if (rowWithRoom) {
			            rowWithRoom.row.push(newEvent);
			            event.subRowIndex = rowWithRoom.index;
			        } else {
			            rows.push([newEvent]);
			            event.subRowIndex = rows.length - 1;
			        }

			        return event;
			    });

			    data.rows = data.locations.map(function(location, i) {
			        return {
			            location: location,
			            rowIndex: i,
			            subRows: locations[location].rows
			        };
			    });

			    return data;
			}

			var timetable = this.timetable;
			var scopeDurationHours = getScopeDurationHours(timetable.scope.hourStart, timetable.scope.hourEnd);
			var container = document.querySelector(selector);
			computeSubRowData(timetable);
			checkContainerPrecondition(container);
			emptyNode(container);
			appendTimetableAside(container);
			appendTimetableSection(container);
		}
	};

})();

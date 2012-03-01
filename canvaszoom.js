/*
 The MIT License

 Copyright (c) 2011 Matthew Wilcoxson (www.akademy.co.uk)

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 */
/*
 CanvasZoom
 By Matthew Wilcoxson

 Description:    Zooming of very large images with Javascript, HTML5 and the canvas element (based on DeepZoom format).
 Website:        http://www.akademy.co.uk/software/canvaszoom/canvaszoom.php
 Version:        1.0.2

 global ImageLoader, window  (for JSLint)
 */
function CanvasZoom(_canvasOrSettings, _tilesFolder, _imageWidth, _imageHeight, _imageId, _mapName) {

	//var t = this; // make "this" accessible when out of "this" scope and minify
	var NULL = null, UNDEFINED = undefined, FALSE = false, TRUE = true;
	// To minify

	//var _tileOverlap = 1; // assumed
	var _tileSize = 256;
	// assumed
	var _fileType = "jpg";
	// assumed

	// Additional settings:
	var _canvas = NULL;
	var _drawBorder = TRUE;

	var _defaultZoom = UNDEFINED;
	var _minZoom = UNDEFINED;
	var _maxZoom = UNDEFINED;

	var _annotationListX = [];
	var _annotationListY = [];
	var _annotationListText = [];
	var _annotationRadius = 15;

	var _scaleAnnotationListX = [];
	var _scaleAnnotationListY = [];

	var _canvasOffsetX = 0;
	var _canvasOffsetY = 0;

	var _currentAnnotation = false;
	var _prevAnnotationIndex = -1;

	var _annotationsShown = true;

	var _imageUrl = "marker.png";
	var _markerImage = new Image();
	_markerImage.src = _imageUrl;
	var _wikiRoot = '/mediawiki/index.php?title=';

	// The index of annotation on which the mouse is currently on
	var _mouseOnAnnotation = -1;

	if(_canvasOrSettings.getContext === UNDEFINED) {

		// settings
		_canvas = _canvasOrSettings.canvas;
		_tilesFolder = _canvasOrSettings.tilesFolder;
		_imageWidth = _canvasOrSettings.imageWidth;
		_imageHeight = _canvasOrSettings.imageHeight;
		_imageId = _canvasOrSettings.imageId;
		_mapName = _canvasOrSettings.mapName;
		_drawBorder = (_canvasOrSettings.drawBorder === UNDEFINED) ? TRUE : _canvasOrSettings.drawBorder;
		_defaultZoom = (_canvasOrSettings.defaultZoom === UNDEFINED) ? UNDEFINED : _canvasOrSettings.defaultZoom;
		_minZoom = (_canvasOrSettings.minZoom === UNDEFINED) ? UNDEFINED : _canvasOrSettings.minZoom;
		_maxZoom = (_canvasOrSettings.maxZoom === UNDEFINED) ? UNDEFINED : _canvasOrSettings.maxZoom;
	} else {

		// canvas
		_canvas = _canvasOrSettings;
	}

	var _debug = FALSE;
	var _debugShowRectangle = (_debug === FALSE) ? _debug : FALSE;
	// Paint a rectangle rather than an image

	var _zoomLevelMin = 0, _zoomLevelMax = 0, _zoomLevelFull = -1, // For painting a background image for all missing tiles.
	_zoomLevel = -1;

	var _mouseX = 0, _mouseY = 0, _mouseDownX = 0, _mouseDownY = 0, _mouseMoveX = 0, _mouseMoveY = 0;

	var _mouseIsDown = FALSE, _mouseLeftWhileDown = FALSE;

	var _offsetX = 0, _offsetY = 0;

	var _aGetWidth = 'w', _aGetHeight = 'h', _aGetTile = 't', _aGetWaiting = 'wt';

	var _tileZoomArray = NULL, _imageLoader = NULL;

	var _ctx = NULL;

	var getTileFile, getEvent, zoom, zoomIn, zoomOut, zoomInMouse, zoomOutMouse, mousePosX, mousePosY, mouseUp, mouseMove, mouseUpWindow, mouseMoveWindow, mouseDown, mouseOut, mouseOver, mouseWheel, initialTilesLoaded, calculateNeededTiles, getTiles, tileLoaded, paint;
	getTileFile = function(zoom, column, row) {
		return _tilesFolder + "/" + zoom + "/" + column + "_" + row + "." + _fileType;
	};
	initialTilesLoaded = function() {

		var tileZoomLevel = _tileZoomArray[_zoomLevel];

		var columns = tileZoomLevel.length;
		var rows = tileZoomLevel[0].length;

		var iColumn = 0, iRow = 0, imageId = 0;
		for( iColumn = 0; iColumn < columns; iColumn++) {

			for( iRow = 0; iRow < rows; iRow++) {

				tileZoomLevel[iColumn][iRow][_aGetTile] = _imageLoader.getImageById(imageId++);
			}
		}

		_tileZoomArray[_zoomLevelFull][0][0][_aGetTile] = _imageLoader.getImageById(imageId);

		//
		// Centre image
		//
		_offsetX = (_canvas.width - tileZoomLevel[_aGetWidth]) / 2;
		_offsetY = (_canvas.height - tileZoomLevel[_aGetHeight]) / 2;

		//
		// Add mouse listener events
		//
		var mouse = 'mouse';
		// minify!
		_canvas.addEventListener(mouse + 'move', function(e) {
			mouseMove(getEvent(e));
		}, TRUE);
		_canvas.addEventListener(mouse + 'down', function(e) {
			mouseDown(getEvent(e));
		}, TRUE);
		_canvas.addEventListener(mouse + 'up', function(e) {
			mouseUp(getEvent(e));
		}, TRUE);
		_canvas.addEventListener(mouse + 'out', function(e) {
			mouseOut(getEvent(e));
		}, TRUE);
		_canvas.addEventListener(mouse + 'over', function(e) {
			mouseOver(getEvent(e));
		}, TRUE);
		_canvas.addEventListener('DOMMouseScroll', function(e) {
			mouseWheel(getEvent(e));
		}, TRUE);
		_canvas.addEventListener(mouse + 'wheel', function(e) {
			mouseWheel(getEvent(e));
		}, TRUE);
		// Keep track even if mouse is outside of canvas while dragging image
		window.addEventListener(mouse + 'up', function(e) {
			mouseUpWindow(getEvent(e));
		}, FALSE);
		window.addEventListener(mouse + 'move', function(e) {
			mouseMoveWindow(getEvent(e));
		}, FALSE);
		_ctx = _canvas.getContext('2d');

		// Show/Hide Annotations on button click
		$('.showhideannotation').click( function() {
			_annotationsShown = !_annotationsShown;
			if (_annotationsShown) {
				this.value = 'Hide Annotations';
			} else {
				this.value = 'Show Annotations';
			}
			$(this).toggleClass("down");
			paint();
		});
		// Get already existing annotations
		$.getJSON("getAnnotations.php", {
			format : "json",
			imageId: _imageId
		}, function(data) {
			for(var i = 0; i < data.length; ++i) {
				_annotationListX.push(parseFloat(data[i].x));
				_annotationListY.push(parseFloat(data[i].y));
				_annotationListText.push(data[i].text);
			}
			paint();
		});
		paint();
	};
	// Helper function
	getEvent = function(event) {
		if(!event)// IE
		{
			event = window.event;
		}

		return event;
	};
	mouseDown = function(event) {
		// removeAnnotations();
		_mouseIsDown = TRUE;
		_mouseLeftWhileDown = FALSE;
		_mouseDownX = mousePosX(event);
		_mouseDownY = mousePosY(event);
		_mouseMoveX = _mouseDownX;
		_mouseMoveY = _mouseDownY;
	};
	mouseUp = function(event) {
		_mouseIsDown = FALSE;
		_mouseLeftWhileDown = FALSE;
		_mouseX = mousePosX(event);
		_mouseY = mousePosY(event);

		if (!_annotationsShown) {
			return;	// Don't add any code that should always execute after this line
		}

		if(_mouseX === _mouseDownX && _mouseY === _mouseDownY) {

			if (_mouseOnAnnotation !== -1) {
				//Show annotation at i
				var txt = "<div class=\"annotationtext\"></div>";//_annotationListText[_mouseOnAnnotation]
				// $.prompt(txt, {
				// buttons: {},
				// persistent: false	//Allow closing box by clicking on facade
				// });
				// var temp = $('.annotationtext').find('img');
				// $('.annotationtext').find('img').width(800);
				// $('.jqi').draggable();
				
				var $dialog = $(txt)
				//.html('This dialog will show every time!')
				.dialog({
					// autoOpen: false,
					// title: 'Basic Dialog',
					modal: true,
					width: 800,
					close: function() {
						$('.annotationtext').remove();
					}
				});

				var title = 'MapID:' + _imageId + 'Coordinates:' + _annotationListX[_mouseOnAnnotation] + ',' + _annotationListY[_mouseOnAnnotation];
				var wikiUrl = _wikiRoot + title;
				$('.annotationtext').append('<iframe id="media-wiki-frame" src="' + wikiUrl + '"/>');
				
				$('#media-wiki-frame').siblings().hide();
		        $('#media-wiki-frame').css('width','100%');
		        $('#media-wiki-frame').css('height','100%');
				
				$('#media-wiki-frame').load(function(){
			        $('#media-wiki-frame').contents().find('#content').siblings().hide();
			        $('#media-wiki-frame').contents().find('#mw-head').show();
			        $('#media-wiki-frame').contents().find('#content').css('margin-left', '1em');
			        $('#media-wiki-frame').contents().find('#mw-head-base').show();
			        $('#media-wiki-frame').contents().find('#mw-page-base').show();
			        $(".annotationtext").dialog("option", "height", $('#media-wiki-frame').height());
		         	$(".annotationtext").dialog("option", "position", "center");
			    });
				    
				var $width = $('.annotationtext').find('img').width();
				var $height = $('.annotationtext').find('img').height();
				
				if ($width > 800) {
					$height = $height * 800.0/$width;	//preserve aspect ratio
					$width = 800;
				}
				
				$('.annotationtext').find('img').width($width);
				$('.annotationtext').find('img').height($height);
				
				// $('#opener').click( function() {
				// $dialog.dialog('open');
				// // prevent the default action, e.g., following a link
				// return false;
				// });
			} else {

				//////////////////////Add Annotation///////////////////////////////
				var scaledAnnotationX = _mouseX - _offsetX;
				var scaledAnnotationY = _mouseY - _offsetY;

				var width = _tileZoomArray[_zoomLevel][_aGetWidth];
				var height = _tileZoomArray[_zoomLevel][_aGetHeight];
				if(_mouseX > _offsetX && _mouseY > _offsetY && _mouseX < _offsetX + width && _mouseY < _offsetY + height) {
					for(var i = _zoomLevel; i < _zoomLevelMax; ++i) {
						var scale = _tileZoomArray[i+1][_aGetWidth] / _tileZoomArray[i][_aGetWidth];
						scaledAnnotationX *= scale;
						scaledAnnotationY *= scale;
					}

					//Add mark on the image
					_annotationListX.push(scaledAnnotationX);
					_annotationListY.push(scaledAnnotationY);
					_annotationListText.push("Unassigned Tag");
					paint();

					
				}
				scaledAnnotationX = Math.floor(scaledAnnotationX);
				scaledAnnotationY = Math.floor(scaledAnnotationY);
				// var txt = '<div class="add-annotation-div"><div class=\"annotationError\">Please enter the annotation</div>Enter the tag:<br /> <textarea id="annotationTextField" name="myname" value="" /></div>';
				var txt = '<div class="add-annotation-div"> <br/><span>What would you like to create? </span><br/><br/><input class="annotation-button create-wiki-button" type="button" value="Wiki Page">\
				<br/><input class="annotation-button TBD-button" type="button" value="TBD" disabled="disabled"><br/> <input class="annotation-button TBD-button" type="button" value="TBD" disabled="disabled">\
				<br/><br/><span>Coordinates: ' + scaledAnnotationX + ', ' + scaledAnnotationY + '<br/>\
				Map name: ' + _mapName + '</span></div>';
				var $dialog = $(txt)
				.dialog({
					modal: true,
					//width: 'auto',
					width: 830,
					maxWidth: 830,
					minHeight: 400,
					buttons: {
						Cancel: function() {
							$( this ).dialog( "close" );
						}
					},
					close: function() {
						_annotationListX.pop();
						_annotationListY.pop();
						_annotationListText.pop();
						paint();
						$('.add-annotation-div').remove();
					}
				});
				$('.annotation-button').button();
				$('.annotation-button').css('width','120');
				$('.create-wiki-button').click(function() {
					var $annotationTextField = $('#annotationTextField');
					var $annotaionText = $('#annotationTextField').val();
					var title = 'MapID:' + _imageId + 'Coordinates:' + scaledAnnotationX + ',' + scaledAnnotationY;
					var wikiUrl = _wikiRoot + title + '&action=edit';
					$('.add-annotation-div').append('<iframe id="media-wiki-frame" src="' + wikiUrl + '"/>');
					
					$('#media-wiki-frame').siblings().hide();
			        $('#media-wiki-frame').css('width','100%');
			        $('#media-wiki-frame').css('height','100%');
					
					$('#media-wiki-frame').load(function(){
				        $('#media-wiki-frame').contents().find('#content').siblings().hide();
				        $('#media-wiki-frame').contents().find('#content').css('margin-left', '1em');
				        $('#media-wiki-frame').contents().find('#mw-head').show();
				        $('#media-wiki-frame').contents().find('#p-personal').siblings().hide();
				        $('#media-wiki-frame').contents().find('#content').find('#wpSave').click(function(){
				        	$('#media-wiki-frame').load(function(){
				        		$('.add-annotation-div').remove();
				        	});
				        });
				        if ($('#media-wiki-frame').height() > 400)
				        	$(".add-annotation-div").dialog("option", "height", $('#media-wiki-frame').height());
			         	$(".add-annotation-div").dialog("option", "position", "center");
				    });
				    
					if ($annotaionText == "") {
						$('.annotationError').show();
						return;
					}
					//////////////////////////////////////////////////////////////////////////////////////
					$.post("addAnnotation.php", {
						x : scaledAnnotationX,
						y : scaledAnnotationY,
						text : title,
						imageId : _imageId
					});
					//////////////////////////////////////////////////////////////////////////////////////

					//Pop the temporarily added annotation (used for showing mark)
					_annotationListX.pop();
					_annotationListY.pop();
					_annotationListText.pop();

					// $( this ).dialog( "close" );

					// Add the correct annotation
					_annotationListX.push(scaledAnnotationX);
					_annotationListY.push(scaledAnnotationY);
					_annotationListText.push($annotaionText);

					paint();
				});

			}
			/////////////////////////////////////////////////////
			// Didn't drag so assume a click.
			// zoomInMouse();
		}
	};
	mouseMove = function(event) {
		_mouseX = mousePosX(event);
		_mouseY = mousePosY(event);

		if(_mouseIsDown) {

			var newOffsetX = _offsetX + (_mouseX - _mouseMoveX);
			var newOffsetY = _offsetY + (_mouseY - _mouseMoveY);

			calculateNeededTiles(_zoomLevel, newOffsetX, newOffsetY);
			_mouseMoveX = _mouseX;
			_mouseMoveY = _mouseY;
			_offsetX = newOffsetX;
			_offsetY = newOffsetY;

			paint();
		} else if (_annotationsShown) {

			var element = _canvas;
			_canvasOffsetX = $(_canvas).offset().left;
			_canvasOffsetY = $(_canvas).offset().top;

			var l = _annotationListX.length;
			var i = 0;

			for(i = 0; i < l; i++) {
				if(_mouseX > _offsetX + _scaleAnnotationListX[i] - _annotationRadius && _mouseX < _offsetX + _scaleAnnotationListX[i] + _annotationRadius &&
				_mouseY > _offsetY + _scaleAnnotationListY[i] - _annotationRadius && _mouseY < _offsetY + _scaleAnnotationListY[i] + _annotationRadius) {

					_canvas.style.cursor = "pointer";
					_mouseOnAnnotation = i;

					// No need to show the annotation on mouse over now.
					/*if (_prevAnnotationIndex != i) {
					 removeAnnotations();
					 _prevAnnotationIndex = i;
					 showAnnotationAt(i);
					 }*/
					break;
				}
			}
			if (i==l) {
				_canvas.style.cursor = "auto";
				_mouseOnAnnotation = -1;
				//Annotations not shown on mouse over. So don't remove.
				//removeAnnotations();
			}
		}
	};
	function removeAnnotations() {
		if (_currentAnnotation) {
			_prevAnnotationIndex = -1;
			//$(_canvas).get(0).parentElement.removeChild(_currentAnnotation);
			$('.fl-annotation').remove();
			_currentAnnotation = false;
		}
	}

	/**
	 * Highlights the annotation at index i
	 * @param i - the index of annotation.
	 */
	var showAnnotationAt = function (i) {

		// Show annotation on mouse over
		_currentAnnotation = document.createElement("div");
		_currentAnnotation.style.position = 'absolute';
		_currentAnnotation.style.top = ( _canvasOffsetY + _offsetY + _scaleAnnotationListY[i]) + "px";
		_currentAnnotation.style.left = (_canvasOffsetX + _offsetX + _scaleAnnotationListX[i]) + "px";
		//that.currentAnnotation.style.width = _annotationRadius + 'px';
		//that.currentAnnotation.style.lineHeight = that.annotationList[i].h + 'px';
		_currentAnnotation.className += ' fl-annotation';

		_currentAnnotation.innerHTML = _annotationListText[i];

		// //Create cross button
		// that.annotationRemoveButton = createCrossButton(that.annotationList[i], i);

		//var temp = $(_canvas);
		$('body').append(_currentAnnotation);
		//$(_canvas).get(0).parentElement.appendChild(_currentAnnotation);
		// container.get()[0].appendChild(that.annotationRemoveButton);
	};
	mousePosX = function(event) {
		// Get the mouse position relative to the canvas element.
		var x = 0;

		if(event.layerX || event.layerX === 0) {// Firefox
			x = event.layerX - _canvas.offsetLeft;
		} else if(event.offsetX || event.offsetX === 0) {// Opera
			x = event.offsetX;
		}

		return x;
	};
	mousePosY = function(event) {
		var y = 0;

		if(event.layerY || event.layerY === 0) {// Firefox
			y = event.layerY - _canvas.offsetTop;
		} else if(event.offsetY || event.offsetY === 0) {// Opera
			y = event.offsetY;
		}

		return y;
	};
	mouseOut = function(event) {
		// removeAnnotations();
		if(_mouseIsDown) {
			_mouseLeftWhileDown = TRUE;
		}
	};
	mouseOver = function(event) {
		// (Should be called mouseEnter IMO...)
		_mouseLeftWhileDown = FALSE;
	};
	mouseWheel = function(event) {
		removeAnnotations();
		var delta = 0;

		if(event.wheelDelta) {/* IE/Opera. */
			delta = -(event.wheelDelta / 120);
		} else if(event.detail) {/* Mozilla */
			delta = event.detail / 3;
		}

		if(delta) {
			if(delta < 0) {
				zoomInMouse();
			} else {
				zoomOutMouse();
			}
		}

		if(event.preventDefault) {
			event.preventDefault();
		}

		event.returnValue = FALSE;
	};
	// If mouseUp occurs outside of canvas while moving, cancel movement.
	mouseUpWindow = function(event) {
		if(_mouseIsDown && _mouseLeftWhileDown) {
			mouseUp(event);
		}
	};
	// keep track of mouse outside of canvas so movement continues.
	mouseMoveWindow = function(event) {
		if(_mouseIsDown && _mouseLeftWhileDown) {
			mouseMove(event);
		}
	};
	// Zoom in a single level
	zoomIn = function(x, y) {
		zoom(_zoomLevel + 1, x, y);
		paint();
	};
	// Zoom out a single level
	zoomOut = function(x, y) {
		zoom(_zoomLevel - 1, x, y);
		paint();
	};
	// Zoom in at mouse co-ordinates
	zoomInMouse = function() {
		zoomIn(_mouseX, _mouseY);
	};
	// Zoom out at mouse co-ordinates
	zoomOutMouse = function() {
		zoomOut(_mouseX, _mouseY);
	};
	//Zoom in at the centre of the canvas
	this.zoomInCentre = function() {
		zoomIn(_canvas.width / 2, _canvas.height / 2);
	};
	//Zoom out at the centre of the canvas
	this.zoomOutCentre = function() {
		zoomOut(_canvas.width / 2, _canvas.height / 2);
	};
	// Change the zoom level and update.
	zoom = function(zoomLevel, zoomX, zoomY) {

		if(zoomLevel >= _zoomLevelMin && zoomLevel <= _zoomLevelMax) {
			// TODO: restrict zoom position to within (close?) area of image.

			var newZoom = zoomLevel, currentZoom = _zoomLevel, currentImageX = zoomX - _offsetX, currentImageY = zoomY - _offsetY;

			var scale = _tileZoomArray[newZoom][_aGetWidth] / _tileZoomArray[currentZoom][_aGetWidth];

			var newImageX = currentImageX * scale, newImageY = currentImageY * scale;

			var newOffsetX = _offsetX - (newImageX - currentImageX), newOffsetY = _offsetY - (newImageY - currentImageY);

			calculateNeededTiles(newZoom, newOffsetX, newOffsetY);
			_zoomLevel = newZoom;
			_offsetX = newOffsetX;
			_offsetY = newOffsetY;
		}
	};
	// Work out which of the tiles we need to download
	calculateNeededTiles = function(zoom, offsetX, offsetY) {

		//
		// Calculate needed tiles
		//
		var tileZoomLevelArray = _tileZoomArray[zoom];

		var canvasLeft = -offsetX, canvasTop = -offsetY;
		var canvasRight = canvasLeft + _canvas.width, canvasBottom = canvasTop + _canvas.height;

		var tileLeft = 0, tileRight = 0, tileTop = 0, tileBottom = 0;
		var tile = NULL;

		var zoomWidth = tileZoomLevelArray[_aGetWidth], zoomHeight = tileZoomLevelArray[_aGetHeight];

		var columns = tileZoomLevelArray.length, rows = tileZoomLevelArray[0].length;

		var iColumn = 0, iRow = 0;
		var tileList = [];
		//new Array();
		for( iColumn = 0; iColumn < columns; iColumn++) {

			for( iRow = 0; iRow < rows; iRow++) {
				tile = tileZoomLevelArray[iColumn][iRow];

				if(tile[_aGetTile] === NULL && tile[_aGetWaiting] === FALSE) {
					tileLeft = iColumn * _tileSize;
					tileRight = tileLeft + Math.min(_tileSize, zoomWidth - tileLeft);
					tileTop = iRow * _tileSize;
					tileBottom = tileTop + Math.min(_tileSize, zoomHeight - tileTop);

					if(!(tileLeft > canvasRight || tileRight < canvasLeft || tileTop > canvasBottom || tileBottom < canvasTop )) {

						// request tile!
						tile[_aGetWaiting] = TRUE;
						tileList.push({
							"name" : zoom + "_" + iColumn + "_" + iRow,
							"file" : getTileFile(zoom, iColumn, iRow)
						});
					}
				}
			}
		}

		getTiles(tileList);
	};
	// Load the tiles we need with ImageLoader
	getTiles = function(tileList) {
		if(tileList.length > 0) {
			_imageLoader = new ImageLoader({
				"images" : tileList,
				"onImageLoaded" : function(name, tile) {
					tileLoaded(name, tile);
				}
			});
		}
	};
	// Tile loaded, save it.
	tileLoaded = function(name, tile) {

		var tileDetails = name.split("_");

		if(tileDetails.length === 3) {

			var tileInfo = _tileZoomArray[tileDetails[0]][tileDetails[1]][tileDetails[2]];
			tileInfo[_aGetTile] = tile;
			tileInfo[_aGetWaiting] = FALSE;

			paint();
		}
	};
	paint = function() {

		var canvasWidth = _canvas.width, canvasHeight = _canvas.height, tileZoomLevelArray = _tileZoomArray[_zoomLevel];

		var columns = tileZoomLevelArray.length, rows = tileZoomLevelArray[0].length, canvasLeft = -_offsetX, canvasTop = -_offsetY;

		var canvasRight = canvasLeft + canvasWidth, canvasBottom = canvasTop + canvasHeight;

		var tileLeft = 0, tileRight = 0, tileTop = 0, tileBottom = 0, tileCount = 0, tile = NULL;

		var zoomWidth = tileZoomLevelArray[_aGetWidth], zoomHeight = tileZoomLevelArray[_aGetHeight];

		//
		// Clear area
		//
		var imageTop = _offsetY, imageLeft = _offsetX, imageBottom = _offsetY + zoomHeight, imageRight = _offsetX + zoomWidth;

		_ctx.clearRect(0, 0, canvasWidth, imageTop + 1);
		// Top
		_ctx.clearRect(0, imageTop, imageLeft + 1, canvasHeight - imageTop);
		// Left
		_ctx.clearRect(imageLeft + zoomWidth - 1, imageTop, canvasWidth - imageLeft - zoomWidth + 1, canvasHeight - imageTop);
		// Right
		_ctx.clearRect(imageLeft, imageTop + zoomHeight, zoomWidth, canvasHeight - imageTop - zoomHeight);
		// Bottom

		//
		// Show images
		//

		// TODO: This pastes a low resolution copy on the background (It's a bit of a hack, a better solution might be to find a nearer zoom (if one is downloaded))
		var fullTile = _tileZoomArray[_zoomLevelFull][0][0][_aGetTile];
		var iColumn = 0, iRow = 0;

		// TODO: Improve this by working out the start / end column and row using the image position instead of looping through them all (still pretty fast though!)
		for( iColumn = 0; iColumn < columns; iColumn++) {

			for( iRow = 0; iRow < rows; iRow++) {
				tileLeft = iColumn * _tileSize;
				tileRight = tileLeft + Math.min(_tileSize, zoomWidth - tileLeft);
				tileTop = iRow * _tileSize;
				tileBottom = tileTop + Math.min(_tileSize, zoomHeight - tileTop);

				if(!(tileLeft > canvasRight || tileRight < canvasLeft || tileTop > canvasBottom || tileBottom < canvasTop )) {
					tile = tileZoomLevelArray[iColumn][iRow][_aGetTile];
					tileLeft += _offsetX;
					tileRight += _offsetX;
					tileTop += _offsetY;
					tileBottom += _offsetY;

					if(tile !== NULL) {

						// Draw tile
						_ctx.drawImage(tile, tileLeft, tileTop);

						if(_debug) {

							_ctx.strokeRect(tileLeft, tileTop, _tileSize, _tileSize);
							tileCount++;
						}
					} else {

						//
						// Tile still loading
						//
						if(!_debug || !_debugShowRectangle) {

							_ctx.save();
							_ctx.beginPath();

							_ctx.moveTo(tileLeft, tileTop);
							_ctx.lineTo(tileRight, tileTop);
							_ctx.lineTo(tileRight, tileBottom);
							_ctx.lineTo(tileLeft, tileBottom);
							_ctx.closePath();

							_ctx.clip();

							// TODO: Fill with a lower zoom image. (or possible use combination of higher zooms??)
							// but scaling images in canvas still VERY SLOW.
							// THIS NOTABLY SLOWS DOWN PANNING WHEN IMAGES ARE NOT YET LOADED ON SOME BROWSERS.
							_ctx.drawImage(fullTile, _offsetX, _offsetY, zoomWidth, zoomHeight);

							_ctx.restore();
						} else {

							_ctx.fillStyle = "#999";
							_ctx.fillRect(tileLeft, tileTop, tileRight - tileLeft, tileBottom - tileTop);
						}
					}
				}
			}
		}

		if (_annotationsShown) {
			var markerHeight = _markerImage.height / (_zoomLevelMax + 1 - _zoomLevel);
			var markerWidth = _markerImage.width / (_zoomLevelMax + 1 - _zoomLevel);

			_scaleAnnotationListX = [];
			_scaleAnnotationListY = [];

			for(var j = 0; j < _annotationListX.length; ++j) {
				_ctx.strokeStyle = "#000";
				var scaledAnnotationX = _annotationListX[j];
				var scaledAnnotationY = _annotationListY[j];
				for(var iZoomLevel = _zoomLevelMax; iZoomLevel > _zoomLevel; --iZoomLevel) {
					var scale = _tileZoomArray[iZoomLevel][_aGetWidth] / _tileZoomArray[iZoomLevel - 1][_aGetWidth];
					scaledAnnotationX /= scale;
					scaledAnnotationY /= scale;
				}

				_scaleAnnotationListX.push(scaledAnnotationX);
				_scaleAnnotationListY.push(scaledAnnotationY);

				_ctx.drawImage(_markerImage, _offsetX + scaledAnnotationX - markerWidth/2, _offsetY + scaledAnnotationY - markerHeight/2 , markerWidth, markerHeight);
				// _ctx.fillRect(_offsetX + scaledAnnotationX, _offsetY + scaledAnnotationY, 10, 10);

			}
		}
		if(_drawBorder) {

			//
			// Canvas area
			//
			_ctx.strokeStyle = "#000";
			_ctx.strokeRect(0, 0, canvasWidth, canvasHeight);
		}

		if(_debug) {

			//
			// DEBUG!
			//
			_ctx.strokeStyle = "#ff0";
			_ctx.strokeRect(canvasLeft, canvasTop, canvasRight - canvasLeft, canvasBottom - canvasTop);
			_ctx.strokeStyle = "#f0f";
			_ctx.strokeRect(imageLeft, imageTop, imageRight - imageLeft, imageBottom - imageTop);

			_ctx.fillStyle = "#0f0";
			_ctx.font = "normal 12px Arial";

			// Text
			_ctx.fillText(_mouseX + "," + _mouseY + " | " + _offsetX + "," + _offsetY + " | " + tileCount, 0, 20);

			// Grid
			_ctx.strokeStyle = "#f00";
			var x, y;
			for( y = 0; y < canvasHeight; y += _tileSize) {
				for( x = 0; x < canvasWidth; x += _tileSize) {
					_ctx.strokeRect(x, y, _tileSize, _tileSize);
				}
			}
		}
	}; ( function() {// setup

		_zoomLevelMax = Math.ceil(Math.log(Math.max(_imageWidth, _imageHeight)) / Math.LN2);
		_tileZoomArray = [];

		var reducingWidth = _imageWidth, reducingHeight = _imageHeight;
		var zoomLevelStart = -1;
		var iZoom = 0, iColumn = 0, iRow = 0, columns = -1, rows = -1;

		for( iZoom = _zoomLevelMax; iZoom >= _zoomLevelMin; iZoom--) {
			columns = Math.ceil(reducingWidth / _tileSize);
			rows = Math.ceil(reducingHeight / _tileSize);

			if(_zoomLevelFull === -1 && reducingWidth <= _tileSize && reducingHeight <= _tileSize) {
				// Largest full image inside single tile.
				_zoomLevelFull = iZoom;
			}

			if(zoomLevelStart === -1 && reducingWidth <= _canvas.width && reducingHeight <= _canvas.height) {
				// Largest full image inside single tile.
				zoomLevelStart = iZoom;
			}

			// Create array for tiles
			_tileZoomArray[iZoom] = [];
			for( iColumn = 0; iColumn < columns; iColumn++) {
				_tileZoomArray[iZoom][iColumn] = [];
			}

			// Set defaults
			// TODO: Test width - possibly to short, maybe not including last tile width...
			_tileZoomArray[iZoom][_aGetWidth] = reducingWidth;
			_tileZoomArray[iZoom][_aGetHeight] = reducingHeight;

			for( iColumn = 0; iColumn < columns; iColumn++) {

				for( iRow = 0; iRow < rows; iRow++) {

					_tileZoomArray[iZoom][iColumn][iRow] = [];

					_tileZoomArray[iZoom][iColumn][iRow][_aGetTile] = NULL;
					_tileZoomArray[iZoom][iColumn][iRow][_aGetWaiting] = FALSE;
				}
			}
			reducingWidth /= 2;
			reducingHeight /= 2;
		}

		if(_defaultZoom === UNDEFINED) {
			_defaultZoom = zoomLevelStart;
		}
		_zoomLevel = _defaultZoom;

		if(_minZoom > _zoomLevelMin) {
			_zoomLevelMin = _minZoom
		}
		if(_maxZoom < _zoomLevelMax) {
			_zoomLevelMax = _maxZoom
		}

		if(_zoomLevelMin > _zoomLevelMax) {
			var zoomMinTemp = _zoomLevelMin;
			_zoomLevelMin = _zoomLevelMax;
			_zoomLevelMax = zoomMinTemp;
		}

		//
		// Initial tile load
		//
		var imageList = [];
		//new Array();
		var imageId = 0;
		columns = _tileZoomArray[_zoomLevel].length;
		rows = _tileZoomArray[_zoomLevel][0].length;

		for( iColumn = 0; iColumn < columns; iColumn++) {

			for( iRow = 0; iRow < rows; iRow++) {

				imageList.push({
					"id" : imageId++,
					"file" : getTileFile(_zoomLevel, iColumn, iRow)
				});
			}
		}

		imageList.push({
			"id" : imageId,
			"file" : getTileFile(_zoomLevelFull, 0, 0)
		});
		_imageLoader = new ImageLoader({
			"images" : imageList,
			"onAllLoaded" : function() {
				initialTilesLoaded();
			},
		});

	}());
}
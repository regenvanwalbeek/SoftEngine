///<reference path="babylon.math.ts"/>
var SoftEngine;
(function (SoftEngine) {
    var Camera = (function () {
        function Camera() {
            this.Position = BABYLON.Vector3.Zero();
            this.Target = BABYLON.Vector3.Zero();
            this.Up = BABYLON.Vector3.Up();
        }
        return Camera;
    })();
    SoftEngine.Camera = Camera;

    var Mesh = (function () {
        // TODO constructor should just take in the array of vertices/faces and verify length so it can be more than a useless struct
        function Mesh(name, numVertices, faceCount) {
            if (name === null || numVertices < 0)
                throw new Error("Invalid parameters to Mesh constructor");

            this.name = name;
            this.Rotation = BABYLON.Vector3.Zero();
            this.Position = BABYLON.Vector3.Zero();
            this.Vertices = new Array(numVertices);
            this.Faces = new Array(faceCount);
        }
        return Mesh;
    })();
    SoftEngine.Mesh = Mesh;

    var Device = (function () {
        function Device(canvas) {
            this.FIELD_OF_VIEW = .70;
            this.Z_NEAR = 0.1;
            this.Z_FAR = 1.0;
            if (canvas === null)
                throw new Error("Invalid parameters to Device constructor. Canvas cannot be null");

            this.workingCanvas = canvas;
            this.workingWidth = canvas.width;
            this.workingHeight = canvas.height;
            this.workingContext = this.workingCanvas.getContext("2d");
        }
        // Clears the back buffer with a specific color
        Device.prototype.clear = function () {
            // Clear with black color by default
            this.workingContext.clearRect(0, 0, this.workingWidth, this.workingHeight);

            // Get back the associated image and clear out back buffer
            this.backbuffer = this.workingContext.getImageData(0, 0, this.workingWidth, this.workingHeight);
        };

        // Flush the back buffer into the front buffer
        Device.prototype.present = function () {
            this.workingContext.putImageData(this.backbuffer, 0, 0);
        };

        // Puts a pixel on the screen at specific x-y coordinates
        Device.prototype.putPixel = function (x, y, color) {
            var index = ((y >> 0) * this.workingWidth + (x >> 0)) * 4;

            // RGBA color space used by the HTML5 canvas
            this.backbuffer.data[index] = color.r * 255;
            this.backbuffer.data[index + 1] = color.g * 255;
            this.backbuffer.data[index + 2] = color.b * 255;
            this.backbuffer.data[index + 3] = color.a * 255;
        };

        // Projects a pixel in 3D object space into 2D coordinates using the transformation matrix (scale, translation, rotation)
        Device.prototype.project = function (coordinate, transformationMatrix) {
            // Transform the coordinates into 3d space
            var point = BABYLON.Vector3.TransformCoordinates(coordinate, transformationMatrix);

            // Transform the coordinates with respect to (0, 0) as the top left
            var x = (point.x * this.workingWidth) + (this.workingWidth * 0.5) >> 0;
            var y = (-point.y * this.workingHeight) + (this.workingHeight * 0.5) >> 0;

            return new BABYLON.Vector2(x, y);
        };

        // Draws a point on the screen
        Device.prototype.drawPoint = function (point) {
            if (point.x < 0 || point.y < 0 || point.x >= this.workingWidth || point.y >= this.workingHeight)
                return;

            this.putPixel(point.x, point.y, new BABYLON.Color4(1, 1, 0, 1));
        };

        // Draws a line on the screen recursively
        Device.prototype.drawLine = function (sourcePoint, destPoint) {
            var distance = destPoint.subtract(sourcePoint).length();
            if (distance < 2)
                return;

            var midPoint = sourcePoint.add(destPoint).scale(0.5);
            this.drawPoint(midPoint);

            // Recursively draw the rest of the line
            this.drawLine(sourcePoint, midPoint);
            this.drawLine(midPoint, destPoint);
        };

        // Draws a line using hte Bresenham line algorithm http://en.wikipedia.org/wiki/Bresenham's_line_algorithm
        Device.prototype.drawBresenhamLine = function (sourcePoint, destPoint) {
            var x0 = sourcePoint.x >> 0;
            var x1 = destPoint.x >> 0;
            var y0 = sourcePoint.y >> 0;
            var y1 = destPoint.y >> 0;
            var deltaX = Math.abs(x1 - x0);
            var deltaY = Math.abs(y1 - y0);
            var stepX = (x0 < x1) ? 1 : -1;
            var stepY = (y0 < y1) ? 1 : -1;
            var err = deltaX - deltaY;

            while (true) {
                this.drawPoint(new BABYLON.Vector2(x0, y0));
                if (x0 == x1 && y0 == y1)
                    return;
                var e2 = 2 * err;
                if (e2 > -deltaY) {
                    err = err - deltaY;
                    x0 = x0 + stepX;
                }
                if (x0 == x1 && y0 == y1) {
                    this.drawPoint(new BABYLON.Vector2(x0, y0));
                    return;
                }
                if (e2 < deltaX) {
                    err = err + deltaX;
                    y0 = y0 + stepY;
                }
            }
        };

        // Main method of the engine that recomputes each vertex projection during each frame
        Device.prototype.render = function (camera, meshes) {
            var viewMatrix = BABYLON.Matrix.LookAtLH(camera.Position, camera.Target, camera.Up);
            var projectionMatrix = BABYLON.Matrix.PerspectiveFovLH(this.FIELD_OF_VIEW, this.workingWidth / this.workingHeight, this.Z_NEAR, this.Z_FAR);

            for (var meshIndex = 0; meshIndex < meshes.length; meshIndex++) {
                var mesh = meshes[meshIndex];

                var rotationMatrix = BABYLON.Matrix.RotationYawPitchRoll(mesh.Rotation.y, mesh.Rotation.x, mesh.Rotation.z);
                var translationMatrix = BABYLON.Matrix.Translation(mesh.Position.x, mesh.Position.y, mesh.Position.z);
                var worldMatrix = rotationMatrix.multiply(translationMatrix);

                var transformMatrix = worldMatrix.multiply(viewMatrix).multiply(projectionMatrix);

                for (var vertexIndex = 0; vertexIndex < mesh.Vertices.length; vertexIndex++) {
                    var projectedPoint = this.project(mesh.Vertices[vertexIndex], transformMatrix);
                    this.drawPoint(projectedPoint);
                }

                for (var faceIndex = 0; faceIndex < mesh.Faces.length; faceIndex++) {
                    var currentFace = mesh.Faces[faceIndex];
                    var vertexA = mesh.Vertices[currentFace.A];
                    var vertexB = mesh.Vertices[currentFace.B];
                    var vertexC = mesh.Vertices[currentFace.C];

                    var pixelA = this.project(vertexA, transformMatrix);
                    var pixelB = this.project(vertexB, transformMatrix);
                    var pixelC = this.project(vertexC, transformMatrix);

                    this.drawBresenhamLine(pixelA, pixelB);
                    this.drawBresenhamLine(pixelB, pixelC);
                    this.drawBresenhamLine(pixelC, pixelA);
                }
            }
        };

        // Loads the JSON file asynchronously and calls back the callback function which takes
        // in an array of meshes loaded
        Device.prototype.LoadJSONFileAsync = function (fileName, callback) {
            var jsonObject = {};

            // TODO do something sane and replace this with jquery or something
            var xmlhttp = new XMLHttpRequest();
            xmlhttp.open("GET", fileName, true);
            var that = this;
            xmlhttp.onreadystatechange = function () {
                if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
                    jsonObject = JSON.parse(xmlhttp.responseText);
                    callback(that.CreateMeshesFromJSON(jsonObject));
                }
            };
            xmlhttp.send(null);
        };

        Device.prototype.CreateMeshesFromJSON = function (jsonObject) {
            var meshes = [];

            for (var meshIndex = 0; meshIndex < jsonObject.meshes.length; meshIndex++) {
                var verticesArray = jsonObject.meshes[meshIndex].vertices;

                // Faces
                var indicesArray = jsonObject.meshes[meshIndex].indices;

                // Depending on the number of texture's coordinates per vertex we're jumping in
                // the vertices array by 6, 8, and 10 windows frame
                var uvCount = jsonObject.meshes[meshIndex].uvCount;
                var verticesStep = 1;
                if (uvCount == 0)
                    verticesStep = 6;
else if (uvCount == 1)
                    verticesStep = 8;
else if (uvCount == 2)
                    verticesStep = 10;

                var verticesCount = verticesArray.length / verticesStep;
                var facesCount = indicesArray.length / 3;
                var mesh = new Mesh(jsonObject.meshes[meshIndex].name, verticesCount, facesCount);

                for (var vertexIndex = 0; vertexIndex < verticesCount; vertexIndex++) {
                    var x = verticesArray[vertexIndex * verticesStep];
                    var y = verticesArray[vertexIndex * verticesStep + 1];
                    var z = verticesArray[vertexIndex * verticesStep + 2];
                    mesh.Vertices[vertexIndex] = new BABYLON.Vector3(x, y, z);
                }

                for (var faceIndex = 0; faceIndex < facesCount; faceIndex++) {
                    var a = indicesArray[faceIndex * 3];
                    var b = indicesArray[faceIndex * 3 + 1];
                    var c = indicesArray[faceIndex * 3 + 2];

                    mesh.Faces[faceIndex] = { A: a, B: b, C: c };
                }

                // Get the position that's been set in blender
                // TODO is this a good idea?
                var position = jsonObject.meshes[meshIndex].position;
                mesh.Position = new BABYLON.Vector3(position[0], position[1], position[2]);
                meshes[meshes.length] = mesh;
            }
            return meshes;
        };
        return Device;
    })();
    SoftEngine.Device = Device;
})(SoftEngine || (SoftEngine = {}));
//# sourceMappingURL=SoftEngine.js.map

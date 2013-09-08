///<reference path="babylon.math.ts"/>
module SoftEngine
{
    export class Camera
    {
        Position: BABYLON.Vector3;
        Target: BABYLON.Vector3;
        Up: BABYLON.Vector3;

        constructor()
        {
            this.Position = BABYLON.Vector3.Zero();
            this.Target = BABYLON.Vector3.Zero();
            this.Up = BABYLON.Vector3.Up();
        }
    }

    export interface Face 
    {
        A: number;
        B: number;
        C: number;
    }

    export class Mesh
    {
        name: String;
        Position: BABYLON.Vector3;
        Rotation: BABYLON.Vector3;
        Vertices: BABYLON.Vector3[];

        // Sets of 3 indices in the Vertices array that make up a face
        Faces: Face[];

        // TODO constructor should just take in the array of vertices/faces and verify length so it can be more than a useless struct
        constructor(name: string, numVertices: number, faceCount: number)
        {
            if (name === null || numVertices < 0)
                throw new Error("Invalid parameters to Mesh constructor");

            this.name = name;
            this.Rotation = BABYLON.Vector3.Zero();
            this.Position = BABYLON.Vector3.Zero();
            this.Vertices = new Array(numVertices);
            this.Faces = new Array(faceCount);
        }
    }

    export class Device
    {
        // Size of the back buffer is equal to the number of pixels to draw on
        // the screen (width * height) * 4 (R,G,B,Alpha values)
        private backbuffer: ImageData;
        private workingCanvas: HTMLCanvasElement;
        private workingContext: CanvasRenderingContext2D;
        private workingWidth: number;
        private workingHeight: number;

        constructor(canvas: HTMLCanvasElement)
        {
            if (canvas === null)
                throw new Error("Invalid parameters to Device constructor. Canvas cannot be null");

            this.workingCanvas = canvas;
            this.workingWidth = canvas.width;
            this.workingHeight = canvas.height;
            this.workingContext = this.workingCanvas.getContext("2d");
        }

        // Clears the back buffer with a specific color
        public clear(): void
        {
            // Clear with black color by default
            this.workingContext.clearRect(0, 0, this.workingWidth, this.workingHeight);

            // Get back the associated image and clear out back buffer
            this.backbuffer = this.workingContext.getImageData(0, 0, this.workingWidth, this.workingHeight);
        }

        // Flush the back buffer into the front buffer
        public present(): void
        {
            this.workingContext.putImageData(this.backbuffer, 0, 0);
        }

        // Puts a pixel on the screen at specific x-y coordinates
        public putPixel(x: number, y: number, color: BABYLON.Color4): void
        {
            var index: number = ((y >> 0) * this.workingWidth + (x >> 0)) * 4;

            // RGBA color space used by the HTML5 canvas
            this.backbuffer.data[index] = color.r * 255;
            this.backbuffer.data[index + 1] = color.g * 255;
            this.backbuffer.data[index + 2] = color.b * 255;
            this.backbuffer.data[index + 3] = color.a * 255;
        }

        // Projects a pixel in 3D object space into 2D coordinates using the transformation matrix (scale, translation, rotation)
        public project(coordinate: BABYLON.Vector3, transformationMatrix: BABYLON.Matrix): BABYLON.Vector2
        {
            // Transform the coordinates into 3d space
            var point: BABYLON.Vector3 = BABYLON.Vector3.TransformCoordinates(coordinate, transformationMatrix);

            // Transform the coordinates with respect to (0, 0) as the top left
            var x: number = (point.x * this.workingWidth) + (this.workingWidth * 0.5) >> 0;
            var y: number = (-point.y * this.workingHeight) + (this.workingHeight * 0.5) >> 0;
            
            return new BABYLON.Vector2(x, y);
        }

        // Draws a point on the screen
        public drawPoint(point: BABYLON.Vector2): void
        {
            // Clip out what's not visible
            if (point.x < 0 || point.y < 0 || point.x >= this.workingWidth || point.y >= this.workingHeight)
                return;

            this.putPixel(point.x, point.y, new BABYLON.Color4(1, 1, 0, 1));
        }

        // Draws a line on the screen recursively
        public drawLine(sourcePoint: BABYLON.Vector2, destPoint: BABYLON.Vector2): void
        {
            var distance: number = destPoint.subtract(sourcePoint).length();
            if (distance < 2)
                return;

            var midPoint: BABYLON.Vector2 = sourcePoint.add(destPoint).scale(0.5);
            this.drawPoint(midPoint);

            // Recursively draw the rest of the line
            this.drawLine(sourcePoint, midPoint);
            this.drawLine(midPoint, destPoint);
        }

        // Draws a line using hte Bresenham line algorithm http://en.wikipedia.org/wiki/Bresenham's_line_algorithm
        public drawBresenhamLine(sourcePoint: BABYLON.Vector2, destPoint: BABYLON.Vector2)
        {
            var x0: number = sourcePoint.x >> 0;
            var x1: number = destPoint.x >> 0;
            var y0: number = sourcePoint.y >> 0;
            var y1: number = destPoint.y >> 0;
            var deltaX: number = Math.abs(x1 - x0);
            var deltaY: number = Math.abs(y1 - y0);
            var stepX: number = (x0 < x1) ? 1 : -1;
            var stepY: number = (y0 < y1) ? 1 : -1;
            var err: number = deltaX - deltaY;

            while (true)
            {
                this.drawPoint(new BABYLON.Vector2(x0, y0));
                if (x0 == x1 && y0 == y1)
                    return;
                var e2:number = 2 * err;
                if (e2 > -deltaY)
                {
                    err = err - deltaY;
                    x0 = x0 + stepX;
                }
                if (x0 == x1 && y0 == y1)
                {
                    this.drawPoint(new BABYLON.Vector2(x0, y0));
                    return;
                }
                if (e2 < deltaX)
                {
                    err = err + deltaX;
                    y0 = y0 + stepY;
                }
            }                  
        }

        private FIELD_OF_VIEW: number = .70;
        private Z_NEAR: number = 0.1;
        private Z_FAR: number = 1.0;

        // Main method of the engine that recomputes each vertex projection during each frame
        public render(camera: Camera, meshes: Mesh[]): void
        {
            var viewMatrix: BABYLON.Matrix = BABYLON.Matrix.LookAtLH(camera.Position, camera.Target, camera.Up);
            var projectionMatrix: BABYLON.Matrix = BABYLON.Matrix.PerspectiveFovLH(this.FIELD_OF_VIEW,
                this.workingWidth / this.workingHeight, this.Z_NEAR, this.Z_FAR);

            // Transform and draw each mesh
            for (var meshIndex: number = 0; meshIndex < meshes.length; meshIndex++)
            {
                var mesh: Mesh = meshes[meshIndex];

                var rotationMatrix: BABYLON.Matrix = BABYLON.Matrix.RotationYawPitchRoll(mesh.Rotation.y, mesh.Rotation.x, mesh.Rotation.z);
                var translationMatrix: BABYLON.Matrix = BABYLON.Matrix.Translation(mesh.Position.x, mesh.Position.y, mesh.Position.z);
                var worldMatrix: BABYLON.Matrix = rotationMatrix.multiply(translationMatrix);

                var transformMatrix: BABYLON.Matrix = worldMatrix.multiply(viewMatrix).multiply(projectionMatrix);

                // Project each 3D point onto 2D and draw it on the screen
                for (var vertexIndex = 0; vertexIndex < mesh.Vertices.length; vertexIndex++)
                {
                    var projectedPoint: BABYLON.Vector2 = this.project(mesh.Vertices[vertexIndex], transformMatrix);
                    this.drawPoint(projectedPoint);
                }

                // Draw lines between each vertex of each face in the mesh
                for (var faceIndex: number = 0; faceIndex < mesh.Faces.length; faceIndex++)
                {
                    var currentFace: Face = mesh.Faces[faceIndex];
                    var vertexA:BABYLON.Vector3 = mesh.Vertices[currentFace.A];
                    var vertexB:BABYLON.Vector3 = mesh.Vertices[currentFace.B];
                    var vertexC:BABYLON.Vector3 = mesh.Vertices[currentFace.C];

                    var pixelA: BABYLON.Vector2 = this.project(vertexA, transformMatrix);
                    var pixelB: BABYLON.Vector2 = this.project(vertexB, transformMatrix);
                    var pixelC: BABYLON.Vector2 = this.project(vertexC, transformMatrix);

                    this.drawBresenhamLine(pixelA, pixelB);
                    this.drawBresenhamLine(pixelB, pixelC);
                    this.drawBresenhamLine(pixelC, pixelA);
                }
            }
        }

        // Loads the JSON file asynchronously and calls back the callback function which takes
        // in an array of meshes loaded
        public LoadJSONFileAsync(fileName: string, callback: (result: Mesh[]) => any): void
        {
            var jsonObject: any = {};
            // TODO do something sane and replace this with jquery or something
            var xmlhttp: XMLHttpRequest = new XMLHttpRequest();
            xmlhttp.open("GET", fileName, true);
            var that:Device = this;
            xmlhttp.onreadystatechange = function ()
            {
                if (xmlhttp.readyState == 4 && xmlhttp.status == 200)
                {
                    jsonObject = JSON.parse(xmlhttp.responseText);
                    callback(that.CreateMeshesFromJSON(jsonObject));
                }
            };
            xmlhttp.send(null);
        }

        private CreateMeshesFromJSON(jsonObject): Mesh[]
        {
            var meshes: Mesh[] = [];

            for (var meshIndex: number = 0; meshIndex < jsonObject.meshes.length; meshIndex++)
            {
                var verticesArray: number[] = jsonObject.meshes[meshIndex].vertices;
                // Faces
                var indicesArray: number[] = jsonObject.meshes[meshIndex].indices;

                // Depending on the number of texture's coordinates per vertex we're jumping in
                // the vertices array by 6, 8, and 10 windows frame
                var uvCount: number = jsonObject.meshes[meshIndex].uvCount;
                var verticesStep : number= 1;
                if (uvCount == 0)
                    verticesStep = 6;
                else if (uvCount == 1)
                    verticesStep = 8;
                else if (uvCount == 2)
                    verticesStep = 10;

                var verticesCount: number = verticesArray.length / verticesStep;
                var facesCount: number = indicesArray.length / 3;
                var mesh = new Mesh(jsonObject.meshes[meshIndex].name, verticesCount, facesCount);

                // Fill in the vertices of the mesh
                for (var vertexIndex: number = 0; vertexIndex < verticesCount; vertexIndex++)
                {
                    var x: number = verticesArray[vertexIndex * verticesStep];
                    var y: number = verticesArray[vertexIndex * verticesStep + 1];
                    var z: number = verticesArray[vertexIndex * verticesStep + 2];
                    mesh.Vertices[vertexIndex] = new BABYLON.Vector3(x, y, z);
                }

                // Fill in the faces of the mesh
                for (var faceIndex: number = 0; faceIndex < facesCount; faceIndex++)
                {
                    var a: number = indicesArray[faceIndex * 3];
                    var b: number = indicesArray[faceIndex * 3 + 1];
                    var c: number = indicesArray[faceIndex * 3 + 2];

                    mesh.Faces[faceIndex] = { A: a, B: b, C: c };                    
                }

                // Get the position that's been set in blender 
                // TODO is this a good idea?
                var position: number[] = jsonObject.meshes[meshIndex].position;
                mesh.Position = new BABYLON.Vector3(position[0], position[1], position[2]);
                meshes[meshes.length] = mesh;
            }
            return meshes;
        }
    }

}
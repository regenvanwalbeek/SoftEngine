///<reference path="SoftEngine.ts"/>

var canvas: HTMLCanvasElement;
var device: SoftEngine.Device;
var meshes: SoftEngine.Mesh[] = [];
var camera: SoftEngine.Camera;

document.addEventListener("DOMContentLoaded", init, false);

function init(): void
{
    canvas = <HTMLCanvasElement> document.getElementById("frontBuffer");
    device = new SoftEngine.Device(canvas);
    camera = new SoftEngine.Camera();

    camera.Position = new BABYLON.Vector3(0, 0, 10);
    camera.Target = BABYLON.Vector3.Zero();

    device.LoadJSONFileAsync("monkey.babylon", loadJSONCompleted);
}

function getCubeMesh(): SoftEngine.Mesh
{
    var mesh:SoftEngine.Mesh = new SoftEngine.Mesh("Cube", 8, 12);

    mesh.Vertices[0] = new BABYLON.Vector3(1, 1, 1);
    mesh.Vertices[1] = new BABYLON.Vector3(1, 1, -1);
    mesh.Vertices[2] = new BABYLON.Vector3(1, -1, 1);
    mesh.Vertices[3] = new BABYLON.Vector3(1, -1, -1);
    mesh.Vertices[4] = new BABYLON.Vector3(-1, 1, 1);
    mesh.Vertices[5] = new BABYLON.Vector3(-1, 1, -1);
    mesh.Vertices[6] = new BABYLON.Vector3(-1, -1, 1);
    mesh.Vertices[7] = new BABYLON.Vector3(-1, -1, -1);

    mesh.Faces[0] = { A: 0, B: 1, C: 2 };
    mesh.Faces[1] = { A: 1, B: 2, C: 3 };
    mesh.Faces[2] = { A: 1, B: 4, C: 0 };
    mesh.Faces[3] = { A: 1, B: 4, C: 5 };
    mesh.Faces[4] = { A: 2, B: 3, C: 6 };
    mesh.Faces[5] = { A: 3, B: 6, C: 7 };
    mesh.Faces[6] = { A: 5, B: 6, C: 4 };
    mesh.Faces[7] = { A: 5, B: 6, C: 7 };
    mesh.Faces[8] = { A: 3, B: 7, C: 5 };
    mesh.Faces[9] = { A: 3, B: 5, C: 1 };
    mesh.Faces[10] = { A: 2, B: 4, C: 6 };
    mesh.Faces[11] = { A: 2, B: 4, C: 0 };
    return mesh;
}

function loadJSONCompleted(meshesLoaded: SoftEngine.Mesh[]): void
{
    meshes = meshesLoaded;
    requestAnimationFrame(drawingLoop);
}

function drawingLoop(): void
{
    device.clear();

    // Rotate the cube slighting during each rendered frame
    for (var meshIndex: number = 0; meshIndex < meshes.length; meshIndex++)
    {
        meshes[meshIndex].Rotation.x += 0.01;
        meshes[meshIndex].Rotation.y += 0.01;
    }
    // Do the matrix operations
    device.render(camera, meshes);
    // Flush the back buffer into the front buffer
    device.present();

    // Call the HTML5 rendering loop
    requestAnimationFrame(drawingLoop);
}
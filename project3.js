/**
 * I used chatGPT as well as the code from project3startcode and assignment 8 to aid the making of this project.
 */

class SceneNode { 
    constructor(buffer = null, vertexCount = 0, color = [], hasTexture = false ) {
        this.children = [];
        this.localMatrix = new Matrix4(); // local transformation matrix
        this.worldMatrix = new Matrix4(); // world transformation matrix
        this.parent = null;
        this.buffer = buffer; // WebGL buffer for this node
        this.vertexCount = vertexCount; // Number of vertices in this node's mesh
        this.color = color;
        this.hasTexture = hasTexture;
    }

    addChild(child) {
        this.children.push(child);
        child.parent = this;
    }

    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            this.children.splice(index, 1);
            child.parent = null;
        }
    }

    updateWorldMatrix(parentWorldMatrix) {
        if (parentWorldMatrix) {
            this.worldMatrix.set(parentWorldMatrix);
            this.worldMatrix.concat(this.localMatrix);
        } else {
            this.worldMatrix.set(this.localMatrix);
        }
        // Update all children
        for (let child of this.children) {
            child.updateWorldMatrix(this.worldMatrix);
        }
    }
}

function convertOBJtoWebGLMesh(objString) {
    const lines = objString.split('\n');
    const vertices = [];
    const normals = [];
    const texCoords = [];
    const faces = [];
    const faceNormals = [];
    const faceTexCoords = [];

    lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const type = parts[0];

        if (type === 'v') {
            // Vertex position
            const x = parseFloat(parts[1]);
            const y = parseFloat(parts[2]);
            const z = parseFloat(parts[3]);
            vertices.push([x, y, z]);
        } else if (type === 'vn') {
            // Vertex normal
            const x = parseFloat(parts[1]);
            const y = parseFloat(parts[2]);
            const z = parseFloat(parts[3]);
            normals.push([x, y, z]);
        } else if (type === 'vt') {
            // Texture coordinate
            const u = parseFloat(parts[1]);
            const v = parseFloat(parts[2]);
            texCoords.push([u, v]);
        } else if (type === 'f') {
            // Face
            const vertexIndices = [];
            const normalIndices = [];
            const texCoordIndices = [];
            for (let i = 1; i < parts.length; i++) {
                const indices = parts[i].split('/');
                const vIndex = parseInt(indices[0]) - 1;
                const tIndex = indices[1] ? parseInt(indices[1]) - 1 : null;
                const nIndex = indices[2] ? parseInt(indices[2]) - 1 : null;
                vertexIndices.push(vIndex);
                texCoordIndices.push(tIndex);
                normalIndices.push(nIndex);
            }
            faces.push(vertexIndices);
            faceTexCoords.push(texCoordIndices);
            faceNormals.push(normalIndices);
        }
    });

    let mesh = [];
    let meshNormals = [];
    let meshTexCoords = [];
    faces.forEach((face, faceIdx) => {
        face.forEach((vertexIdx, i) => {
            const vertex = vertices[vertexIdx];
            mesh.push(...vertex);

            const normalIdx = faceNormals[faceIdx][i];
            if (normalIdx !== null && normals[normalIdx]) {
                meshNormals.push(...normals[normalIdx]);
            } else {
                // Default normal if none provided
                meshNormals.push(0, 0, 1);
            }

            const texCoordIdx = faceTexCoords[faceIdx][i];
            if (texCoordIdx !== null && texCoords[texCoordIdx]) {
                meshTexCoords.push(...texCoords[texCoordIdx]);
            } else {
                // Default texture coordinate if none provided
                meshTexCoords.push(0, 0);
            }
        });
    });

    const vertexCount = mesh.length / 3;
    const meshVertexSize = 3;

    console.log("mesh normals in conversion function", meshNormals);
    console.log("mesh texture coordinates in conversion function", meshTexCoords);

    return {
        mesh,
        meshNormals,
        meshTexCoords,
        vertexCount,
        meshVertexSize
    };
}


async function loadOBJFile(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const objString = await response.text();
        return objString;
    } catch (error) {
        console.error('Error loading OBJ file:', error);
    }
}

// Vertex Shader
var VSHADER_SOURCE = `
    attribute vec3 a_Position;
    attribute vec3 a_Normal;

    attribute vec2 a_TexCoord; // Add texture coordinates

    uniform mat4 u_Model;
    uniform mat4 u_World;
    uniform mat4 u_Camera;
    uniform mat4 u_Projection;

    varying vec3 v_Normal;
    varying vec3 v_Position;
    varying vec2 v_TexCoord; // Pass texture coordinates


    void main() {
        gl_Position = u_Projection * u_Camera * u_World * u_Model * vec4(a_Position, 1.0);;

        v_Normal = a_Normal;
        v_Position = a_Position;
        v_TexCoord = a_TexCoord; // Pass texture coordinates
}

`;

// Fragment Shader
var FSHADER_SOURCE = `
    precision mediump float;

    varying vec3 v_Normal;
    varying vec3 v_Position;
    varying vec2 v_TexCoord; // Add texture coordinates


    uniform int u_Lighting;
    uniform int u_texturing;

    uniform highp mat4 u_Model;
    uniform highp mat4 u_World;
    uniform highp mat4 u_Camera;
    uniform highp mat4 u_CameraInverse;
    uniform highp mat4 u_InverseTranspose;
    uniform vec3 u_Light; // where the light is located
    uniform vec3 u_AmbientLight; // the lighting from the world
    uniform vec3 u_DiffuseColor; // the base color of the model
    uniform float u_SpecPower; // the specular "power" of the light on this model
    uniform vec3 u_SpecColor; // the specular color on this model

    uniform sampler2D u_Sampler; // Add sampler for texture


    //need hom_reduce function here, find in starter code
        // helper function for homogeneous transformation
    mediump vec3 hom_reduce(mediump vec4 v) {
        // component-wise division of v
        return vec3(v) / v.w;
    }


    void main() {
        if (u_Lighting > 0) {
            // usual normal transformation
            vec3 worldNormal = normalize(mat3(u_InverseTranspose) * normalize(v_Normal));
            // usual position transformation
            vec3 worldPos = hom_reduce(u_World * u_Model * vec4(v_Position, 1.0));

            // also transform the position into the camera space to calculate the specular
            vec3 cameraPos = hom_reduce(u_Camera * vec4(worldPos, 1.0));

            // calculate our light direction
            vec3 lightDir = normalize(u_Light - worldPos); // get the direction towards the light

            // first, calculate our diffuse light
            float diffuse = dot(lightDir, worldNormal);
            // float diffuse = max(dot(lightDir, worldNormal), 0.0);


            // second, calculate our specular highlight
            // see https://learnopengl.com/Lighting/Basic-Lighting for more details
            vec3 reflectDir = normalize(reflect(-lightDir, worldNormal)); // reflect the light past our normal

            // We need our reflection to be in Camera space
            // note that this is a direction rather than a normal
            // so we don't need an inverse transpose of the world->camera matrix
            // but we _do_ need to apply a linear operation, so we use mat3
            vec3 cameraReflectDir = normalize(mat3(u_Camera) * reflectDir);

            // Now, get the direction to the camera, noting that the camera is at 0, 0, 0 in camera space
            vec3 cameraDir = normalize(-cameraPos);

            // calculate the angle between the cameraDir and
            //   the reflected light direction _toward_ the camera(in camera space)
            float angle = max(dot(cameraDir, cameraReflectDir), 0.0);
            // calculate fall-off with power
            float specular = pow(angle, u_SpecPower);


            vec4 texColor = texture2D(u_Sampler, v_TexCoord);

            // finally, add our lights together
            // note that webGL will take the min(1.0, color) for us for each color component
            if (u_texturing > 0) {
                gl_FragColor = vec4(u_AmbientLight + diffuse * texColor.rgb + specular * u_SpecColor, 1.0);
            } else {
                gl_FragColor = vec4(u_AmbientLight + diffuse * u_DiffuseColor + specular * u_SpecColor, 1.0);
            }
            

            // gl_FragColor = vec4(v_Normal * 0.8 + 0.5, 1.0); // Visualize normals

        }
        else {
            gl_FragColor = vec4(u_AmbientLight, 1.0);
        }
    }   

`;

var g_last_frame_ms, gl;
var g_u_model_ref, g_u_world_ref;

//#region added camera and grid matrix init
var g_camera_matrix
var g_near
var g_far
var g_fovy
var g_aspect
var g_grid_vertex_count

var g_light_x
var g_light_y
var g_light_z

var g_lighting_ref
var g_texturing_ref
var g_inverse_transpose_ref
var g_camera_inverse_transpose_ref
var g_light_ref
var g_ambient_light
var g_diffuse_color
var g_spec_power
var g_spec_color

const INITIAL_CAMERA_X = 0
const INITIAL_CAMERA_Y = 0
const INITIAL_NEAR = 1
const INITIAL_FAR = 20
const INITIAL_FOVY = 90
const INITIAL_ASPECT = 1
const INITIAL_LIGHT_X = 0//4
const INITIAL_LIGHT_Y = 0//7
const INITIAL_LIGHT_Z = 2
//#endregion

// Updated Cube Mesh with per-vertex colors
var CUBE_MESH = [
    // front face
     1.0,  1.0,  1.0,
    -1.0,  1.0,  1.0,
    -1.0, -1.0,  1.0,

     1.0,  1.0,  1.0,
    -1.0, -1.0,  1.0,
     1.0, -1.0,  1.0,

    // back face
    1.0,  1.0, -1.0,
    -1.0, -1.0, -1.0,
    -1.0,  1.0, -1.0,

    1.0,  1.0, -1.0,
    1.0, -1.0, -1.0,
    -1.0, -1.0, -1.0,

    // right face
     1.0,  1.0,  1.0,
     1.0, -1.0, -1.0,
     1.0,  1.0, -1.0,

     1.0,  1.0,  1.0,
     1.0, -1.0,  1.0,
     1.0, -1.0, -1.0,

    // left face
    -1.0,  1.0,  1.0,
    -1.0,  1.0, -1.0,
    -1.0, -1.0, -1.0,

    -1.0,  1.0,  1.0,
    -1.0, -1.0, -1.0,
    -1.0, -1.0,  1.0,

    // top face
     1.0,  1.0,  1.0,
     1.0,  1.0, -1.0,
    -1.0,  1.0, -1.0,

     1.0,  1.0,  1.0,
    -1.0,  1.0, -1.0,
    -1.0,  1.0,  1.0,

    // bottom face
     1.0, -1.0,  1.0,
    -1.0, -1.0, -1.0,
     1.0, -1.0, -1.0,

     1.0, -1.0,  1.0,
    -1.0, -1.0,  1.0,
    -1.0, -1.0, -1.0,
]
var CUBE_NORMALS = [
    // front face
     0.0,  0.0,  1.0, // Normal pointing out of the front face
     0.0,  0.0,  1.0,
     0.0,  0.0,  1.0,

     0.0,  0.0,  1.0,
     0.0,  0.0,  1.0,
     0.0,  0.0,  1.0,

    // back face
     0.0,  0.0, -1.0, // Normal pointing out of the back face
     0.0,  0.0, -1.0,
     0.0,  0.0, -1.0,

     0.0,  0.0, -1.0,
     0.0,  0.0, -1.0,
     0.0,  0.0, -1.0,

    // right face
     1.0,  0.0,  0.0, // Normal pointing out of the right face
     1.0,  0.0,  0.0,
     1.0,  0.0,  0.0,

     1.0,  0.0,  0.0,
     1.0,  0.0,  0.0,
     1.0,  0.0,  0.0,

    // left face
    -1.0,  0.0,  0.0, // Normal pointing out of the left face
    -1.0,  0.0,  0.0,
    -1.0,  0.0,  0.0,

    -1.0,  0.0,  0.0,
    -1.0,  0.0,  0.0,
    -1.0,  0.0,  0.0,

    // top face
     0.0,  1.0,  0.0, // Normal pointing out of the top face
     0.0,  1.0,  0.0,
     0.0,  1.0,  0.0,

     0.0,  1.0,  0.0,
     0.0,  1.0,  0.0,
     0.0,  1.0,  0.0,

    // bottom face
     0.0, -1.0,  0.0, // Normal pointing out of the bottom face
     0.0, -1.0,  0.0,
     0.0, -1.0,  0.0,

     0.0, -1.0,  0.0,
     0.0, -1.0,  0.0,
     0.0, -1.0,  0.0,
];
const CUBE_TEX_MAPPING = [
    // front face
    1, 1, 
    0, 0, 
    0, 1, 
    1, 1, 
    1, 0,
    0, 0, 
    

    // back face
    1, 1,
    0, 1,
    0, 0,
    1, 1,
    0, 0,
    1, 0,

    // right face 
    0, 0,
    1, 1,
    1, 0,
    0, 0,
    0, 1,
    1, 1,

    // left face 
    1, 0,
    0, 0,
    0, 1,
    1, 0,
    0, 1,
    1, 1,

    // top face 
    0, 1,
    1, 1,
    1, 0,
    0, 1,
    1, 0,
    0, 0,

    // bottom face 
    1, 0,
    0, 1,
    1, 1,
    1, 0,
    0, 0,
    0, 1,
];

var CUBE_VERTEX_COUNT = 36;
var CUBE_VERTEXT_SIZE = 3;


var isDragging = false;    // Boolean to track if dragging is in progress
var lastMouseX = 0, lastMouseY = 0; // Store the last mouse coordinates

var armNode;

// Main Function
async function main() {

    setupControls();
    setupArrowKeyControls();
    setupProjectionToggle();
    setupRotationSpeedControl(); // Initialize rotation speed slider

    //#region sliders
    slider_input = document.getElementById('sliderLightX')
    slider_input.addEventListener('input', (event) => {
        updateLightX(event.target.value)
    })
    slider_input = document.getElementById('sliderLightY')
    slider_input.addEventListener('input', (event) => {
        updateLightY(event.target.value)
    })
    slider_input = document.getElementById('sliderLightZ')
    slider_input.addEventListener('input', (event) => {
        updateLightZ(event.target.value)
    })

    slider_input = document.getElementById('sliderNear')
    slider_input.addEventListener('input', (event) => {
        updateNear(event.target.value)
    })

    slider_input = document.getElementById('sliderFar')
    slider_input.addEventListener('input', (event) => {
        updateFar(event.target.value)
    })

    slider_input = document.getElementById('sliderFOVY')
    slider_input.addEventListener('input', (event) => {
        updateFOVY(event.target.value)
    })

    slider_input = document.getElementById('sliderAspect')
    slider_input.addEventListener('input', (event) => {
        updateAspect(event.target.value)
    })
    //#endregion

    var canvas = document.getElementById('webgl');

    gl = getWebGLContext(canvas, true);
    if (!gl || !initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
        console.log('Failed to get the rendering context for WebGL or intialize shaders.')
        return;
    }

    const { mesh: DIAMOND_MESH, meshNormals: DIAMOND_MESH_NORMAL, vertexCount:DIAMOND_VERTEX_COUNT, meshVertexSize:DIAMOND_VERTEX_SIZE} = await loadOBJ('./diamond_with_normals.obj');
    const { mesh: ICOSAHEDRON_MESH, meshNormals: ICOSAHEDRON_MESH_NORMAL, vertexCount:ICOSAHEDRON_VERTEX_COUNT, meshVertexSize:ICOSAHEDRON_VERTEX_SIZE} = await loadOBJ('./icosahedron_with_normals.obj');
    const { mesh: ALTAR_MESH, meshTexCoords:ALTAR_TEXT_COORDS, meshNormals: ALTAR_MESH_NORMAL, vertexCount:ALTAR_VERTEX_COUNT, meshVertexSize:ALTAR_VERTEX_SIZE} = await loadOBJ("./altar.obj");
    const { mesh: MAN_MESH, meshNormals: MAN_MESH_NORMAL, vertexCount: MAN_VERTEX_COUNT, meshVertexSize: MAN_VERTEX_SIZE} = await loadOBJ("./man_with_normal.obj");
    console.log('altar text coord', ALTAR_TEXT_COORDS)
    const { mesh: TAILS_MESH,meshTexCoords:TAILS_TEXT_COORDS, meshNormals: TAILS_NORMAL, vertexCount: TAILS_VERTEX_COUNT, meshVertexSize: TAILS_VERTEX_SIZE} = await loadOBJ("./tails.obj");

    //#region added grid buffer
    // get the grid mesh and colors
    // use a spacing of 1 for now, for a total of 200 lines
    // use a simple green color
    grid_data = build_grid_attributes(1, 1)
    grid_mesh = grid_data[0]
    grid_normals = grid_data[1] // fake normals


    var gridBuffer = gl.createBuffer();
    if (!gridBuffer) {
        console.log("Failed to create cube vertex buffer")
        return -1
    }

    gridAttribute = grid_mesh.concat(grid_normals)
    gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gridAttribute),  gl.STATIC_DRAW)
    
    //#endregion
    gridColor = [1.0, 0.0, 0.0]
    //#region added grid node creation
    var gridNode = new SceneNode(gridBuffer, g_grid_vertex_count, gridColor, false); 
    //#endregion
   

    //#region addObjects
    let cyanColor = [0, 1, 1]
    let blueColor = [0.5, 0.5, 1.0]
    let darkCyan = [0, 0.55, 0.55]
    /**
     * Create diamond nodes with hierarchy
     */
    let diamondNode1_2 = await addObject(
        mesh=DIAMOND_MESH,
        vertex_count=DIAMOND_VERTEX_COUNT,
        normals=DIAMOND_MESH_NORMAL,
        isTex = false,
        texCoord = null,
        nodeName='DiamondNode1_2',
        color= cyanColor,
        children=null,
        rotate=null,
        scale={ x: 0.3, y: 0.3, z: 0.3 },
        translate= { x: 30, y: 0, z: 20 }
    );

    let diamondNode2_2 = await addObject(
        mesh=DIAMOND_MESH,
        vertex_count=DIAMOND_VERTEX_COUNT,
        normals=DIAMOND_MESH_NORMAL,
        isTex = false,
        texCoord = null,
        nodeName='DiamondNode2_2',
        color= cyanColor,
        children=null,
        rotate=null,
        scale={ x: 0.3, y: 0.3, z: 0.3 },
        translate={ x: -30, y: 0, z: -20 }
    );

    let diamondNode = await addObject(
        mesh=DIAMOND_MESH,
        vertex_count=DIAMOND_VERTEX_COUNT,
        normals=DIAMOND_MESH_NORMAL,
        isTex = false,
        texCoord = null,
        nodeName='DiamondNode',
        color= cyanColor,
        children=[diamondNode1_2],
        rotate=null,
        scale={ x: 0.05, y: 0.05, z: 0.05 },
        translate={ x: 0, y: 1, z: 0 }
    );

    let diamondNode2 = await addObject(
        mesh=DIAMOND_MESH,
        vertex_count=DIAMOND_VERTEX_COUNT, // Visualize normals
        normals=DIAMOND_MESH_NORMAL,
        isTex = false,
        texCoord = null,
        nodeName='DiamondNode2',
        color= cyanColor,
        children=[diamondNode2_2],
        rotate=null,
        scale={ x: 0.05, y: 0.05, z: 0.05 },
        translate={ x: 0, y: -1, z: 0 }
    );

    /**
     * Create icosahedron nodes with hierarchy
     */
    let icosahedronNode1_2 = await addObject(
        mesh=ICOSAHEDRON_MESH,
        vertex_count=ICOSAHEDRON_VERTEX_COUNT,
        normals = ICOSAHEDRON_MESH_NORMAL,
        isTex = false,
        texCoord = null,
        nodeName='IcosahedronNode1_2',
        color=darkCyan,
        children=null,
        rotate=null,
        scale={ x: 0.7, y: 0.7, z: 0.7 },
        translate={ x: 2, y: 0, z: 1 }
    );

    let icosahedronNode2_2 = await addObject(
        mesh=ICOSAHEDRON_MESH,
        vertex_count=ICOSAHEDRON_VERTEX_COUNT,
        normals = ICOSAHEDRON_MESH_NORMAL,
        isTex = false,
        texCoord = null,
        nodeName='IcosahedronNode2_2',
        color=darkCyan,
        children=null,
        rotate=null,
        scale={ x: 0.7, y: 0.7, z: 0.7 },
        translate={ x: -2, y: 0, z: -1 }
    );

    let icosahedronNode = await addObject(
        mesh=ICOSAHEDRON_MESH,
        vertex_count=ICOSAHEDRON_VERTEX_COUNT,
        normals = ICOSAHEDRON_MESH_NORMAL,
        isTex = false,
        texCoord = null,
        nodeName='IcosahedronNode',
        color=darkCyan,
        children=[icosahedronNode1_2],
        rotate=null,
        scale={ x: 0.4, y: 0.4, z: 0.4 },
        translate={ x: 1.3, y: 0, z: 1 }
    );

    let icosahedronNode2 = await addObject(
        mesh=ICOSAHEDRON_MESH,
        vertex_count=ICOSAHEDRON_VERTEX_COUNT,
        normals = ICOSAHEDRON_MESH_NORMAL,
        isTex = false,
        texCoord = null,
        nodeName='IcosahedronNode2',
        color=darkCyan,
        children=[icosahedronNode2_2],
        rotate=null,
        scale={ x: 0.4, y: 0.4, z: 0.4 },
        translate={ x: -1.3, y: 0, z: -1 }
    );

    /**
     * Create armNode with child nodes attached
     */
    let armNode = await addObject(
        mesh= CUBE_MESH,
        vertex_count=CUBE_VERTEX_COUNT,
        normals = CUBE_NORMALS,
        isTex = false,
        texCoord = CUBE_TEX_MAPPING,
        nodeName='ArmNode',
        color=[1.0, 0.0, 0.0],
        children=[diamondNode, diamondNode2, icosahedronNode, icosahedronNode2],
        rotate=null,
        scale={ x: 0.4, y: 0.4, z: 0.4 },
        translate={ x: 0, y: 0.2, z: 0 }
    );
    let tailsNode = await addObject(
        mesh=TAILS_MESH,
        vertex_count = TAILS_VERTEX_COUNT,
        normals = TAILS_NORMAL,
        isTex = true,
        texCoord = TAILS_TEXT_COORDS,
        nodeName='TailsNode',
        color='red',
        children=null,
        rotate={y:-10},
        scale={ x: 0.7, y: 0.7, z: 0.7 },
        translate={ x: 1.5, y: 2, z: -0.3 }
    )

    let manNode = await addObject(
        mesh=MAN_MESH,
        vertex_count = MAN_VERTEX_COUNT,
        normals = MAN_MESH_NORMAL,
        isTex = true,
        texCoord = null,
        nodeName='ManNode',
        color = [0.8, 0.5, 0.2],
        children=[tailsNode],
        rotate=null,
        scale={ x: 1, y: 1, z: 1 },
        translate={ x: 0, y: -1, z: -1 }
    )

   

    let altarNode = await addObject(ALTAR_MESH, ALTAR_VERTEX_COUNT, ALTAR_MESH_NORMAL, false, ALTAR_TEXT_COORDS, "altar",color=blueColor, children=null,rotate={y:45},scale={x:0.8,y:0.8,z:0.8}, translate={x:0, y:-1, z:0})
    //#endregion

    // Initialize the canvas for dragging functionality
    setupCanvasDrag(canvas);

    g_u_world_ref = gl.getUniformLocation(gl.program, 'u_World');
    g_u_model_ref = gl.getUniformLocation(gl.program, 'u_Model');

    g_camera_ref = gl.getUniformLocation(gl.program, 'u_Camera')
    g_projection_ref = gl.getUniformLocation(gl.program, 'u_Projection')

    gridNode.localMatrix.setTranslate(0, -1, 0);
    // Initially the camera is just the identity
    g_camera_matrix = new Matrix4()

    g_lighting_ref = gl.getUniformLocation(gl.program, 'u_Lighting')
    g_inverse_transpose_ref = gl.getUniformLocation(gl.program, 'u_InverseTranspose')
    g_light_ref = gl.getUniformLocation(gl.program, 'u_Light')
    g_ambient_light = gl.getUniformLocation(gl.program, 'u_AmbientLight')
    g_diffuse_color = gl.getUniformLocation(gl.program, 'u_DiffuseColor')
    g_spec_power = gl.getUniformLocation(gl.program, 'u_SpecPower')
    g_spec_color = gl.getUniformLocation(gl.program, 'u_SpecColor')

    g_texturing_ref = gl.getUniformLocation(gl.program, 'u_texturing')


    var texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.uniform1i(gl.getUniformLocation(gl.program, 'u_Sampler'), 0);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    var image = new Image();
    image.src = "snow.jpg";
    image.addEventListener('load', function() {
        // TODO: uncomment this once you have a texture setup
        console.log('Texture Loaded:', image.complete);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D)
    });
    
    // Initial values
    updateNear(INITIAL_NEAR)
    updateFar(INITIAL_FAR)
    updateFOVY(INITIAL_FOVY)
    updateAspect(INITIAL_ASPECT)

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    // Animation timing
    g_last_frame_ms = Date.now();
    tick();
    updateCameraMatrix();
    updateCameraDirection();

    updateLightX(INITIAL_LIGHT_X)
    updateLightY(INITIAL_LIGHT_Y)
    updateLightZ(INITIAL_LIGHT_Z)

    function tick() {
        var delta_time 
        var current_time = Date.now()
        delta_time = current_time - g_last_frame_ms;
        g_last_frame_ms = current_time;
    
        // Apply rotation speed to angles
        var angle = rotationSpeed * 0.03 * delta_time;
        var angle2 = rotationSpeed * 0.04 * delta_time;
        var angle3 = rotationSpeed * 0.05 * delta_time;
        var angle4 = rotationSpeed * 0.06 * delta_time;  

        armNode.localMatrix.concat(new Matrix4().setRotate(angle, 1, 1, 0));
        diamondNode.localMatrix.concat(new Matrix4().setRotate(angle3, 1, 0, 1));
        diamondNode1_2.localMatrix.concat(new Matrix4().setRotate(angle2, 0, 1, 0))
        diamondNode2.localMatrix.concat(new Matrix4().setRotate(angle2, 1, 0, 1));
        diamondNode2_2.localMatrix.concat(new Matrix4().setRotate(angle3, 1, 1, 0))
        icosahedronNode.localMatrix.concat(new Matrix4().setRotate(angle4, 0, 1, 1));
        icosahedronNode1_2.localMatrix.concat(new Matrix4().setRotate(angle2, 1, 1, 1));
        icosahedronNode2.localMatrix.concat(new Matrix4().setRotate(angle4, 1, 1, 1));
        icosahedronNode2_2.localMatrix.concat(new Matrix4().setRotate(angle2, 1, 0, 1));

        updateProjectionMatrix();


        gl.uniformMatrix4fv(g_camera_ref, false, g_camera_matrix.elements)
    
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        //Draw root node
        drawScene(armNode);
        drawScene(altarNode);
        drawScene(gridNode);
        drawScene(manNode);
        drawScene(tailsNode);

        requestAnimationFrame(tick, canvas);
    }

    function drawScene(node) {
        // Update the node's world matrix
        node.updateWorldMatrix(node.parent ? node.parent.worldMatrix : null);
    
        // Bind the appropriate buffer for this node
        if (node.buffer && node.vertexCount > 0) {
            gl.bindBuffer(gl.ARRAY_BUFFER, node.buffer);

            if (setup_vec3('a_Position', 0, 0) < 0) {
                return -1;
            }

            if (setup_vec3('a_Normal', 0, node.vertexCount * 3 * 4) < 0) {
                return -1;
            }


            if (node.hasTexture == true){     
                if (setup_vec3('a_TexCoord', 0, node.vertexCount * ALTAR_MESH_NORMAL * 4) < 0) {
                    return -1;
                }
            }

            // Set the world and local matrix uniforms
            gl.uniformMatrix4fv(g_u_world_ref, false, node.worldMatrix.elements);
            gl.uniformMatrix4fv(g_u_model_ref, false, node.localMatrix.elements);
            const normalMatrix = new Matrix4();
            normalMatrix.setInverseOf(node.worldMatrix);
            normalMatrix.transpose();
            gl.uniformMatrix4fv(g_inverse_transpose_ref, false, normalMatrix.elements);

            if (node === gridNode) {
                // Uniforms for the grid
                gl.uniform1i(g_lighting_ref, 0); // Disable lighting
                gl.uniform3fv(g_ambient_light, new Float32Array([0.0, .5, .8])); // Set red color
            } else {
                // Uniforms for other nodes with lighting
                if (node.hasTexture == true){
                    gl.uniform1i(g_texturing_ref, 1) 
                } else {
                    gl.uniform1i(g_texturing_ref, 0) 
                }
                
                console.log("diffuse color ", node.color)
                gl.uniform1i(g_lighting_ref, 1); // Enable lighting
                gl.uniform3fv(g_ambient_light, new Float32Array([0.2, 0.2, 0.2])); // Slight ambient light
                gl.uniform3fv(g_diffuse_color, new Float32Array(node.color)); // Diffuse color for objects
                gl.uniform1f(g_spec_power, 128.0); // Lower power for broader specular highlight
                gl.uniform3fv(g_spec_color, new Float32Array([1.0, 1.0, 1.0])); // Bright specular highlights
                gl.uniform3fv(g_light_ref, new Float32Array([g_light_x, g_light_y, g_light_z]));
            } 
            // Draw the current node
            gl.drawArrays(gl.TRIANGLES, 0, node.vertexCount);
        }

        // Recursively draw all the children of this node
        for (let child of node.children) {
            // console.log("draw children")
            drawScene(child);
        }

    }

    function setupCanvasDrag(canvas) {
        // When mouse button is pressed down, start tracking drag
        canvas.addEventListener('mousedown', function (event) {
            isDragging = true;
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
        });
    
        // When mouse is moved, update the position if dragging is in progress
        canvas.addEventListener('mousemove', function (event) {
            if (isDragging) {
                var deltaX = event.clientX - lastMouseX;
                var deltaY = event.clientY - lastMouseY;
    
                // Convert pixel delta to world coordinates (assuming small scaling factor)
                // Adjust the scaling factor as necessary for desired sensitivity
                var scale = 0.01; 
                var translateX = deltaX * scale;
                var translateY = -deltaY * scale; // Flip Y axis as canvas coordinates are opposite to WebGL
    
                // Apply translation to the armNode's local matrix
                armNode.localMatrix.translate(translateX, translateY, 0);
    
                // Update last mouse position
                lastMouseX = event.clientX;
                lastMouseY = event.clientY;
    
                // Redraw the scene
                drawScene(armNode);
            }
        });
    
        // When mouse button is released, stop tracking drag
        canvas.addEventListener('mouseup', function (event) {
            isDragging = false;
        });
    
        // If the mouse leaves the canvas, end dragging (for robustness)
        canvas.addEventListener('mouseleave', function (event) {
            isDragging = false;
        });
    }

}

function drawNode(node, vertexCount) {
    gl.uniformMatrix4fv(g_u_model_ref, false, node.localMatrix.elements);
    gl.uniformMatrix4fv(g_u_world_ref, false, node.worldMatrix.elements);
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
}

// Helper to setup vec3 attributes
function setup_vec3(name, stride, offset) {
    // Get the attribute
    var attributeID = gl.getAttribLocation(gl.program, `${name}`)
    if (attributeID < 0) {
        console.log(`Failed to get the storage location of ${name}`)
        return -1;
    }

    // Set how the GPU fills the a_Position variable with data from the GPU 
    gl.vertexAttribPointer(attributeID, 3, gl.FLOAT, false, stride, offset)
    gl.enableVertexAttribArray(attributeID)

    return 0
}

function build_color_attributes(g_vertex_count, colorChoice='b') {
    console.log("doing");
    var colors = [];
    var color1, color2, color3;

    // Define three colors based on choice
    if (colorChoice == 'cyan') {
        color1 = [0.3, 0.6, 0.6];   // Less saturated dark cyan
        color2 = [0.4, 0.7, 0.7];   // Less saturated medium cyan
        color3 = [0.5, 0.8, 0.8];   // Less saturated light cyan
    } else if (colorChoice == 'darkCyan') {
        color1 = [0.0, 0.3, 0.3];   // Darker cyan
        color2 = [0.1, 0.4, 0.4];   // Medium dark cyan
        color3 = [0.2, 0.5, 0.5];   // Lighter dark cyan
    } else if (colorChoice == 'red') {
        color1 = [0.5, 0.0, 0.0];   // Dark red
        color2 = [0.75, 0.25, 0.25]; // Medium red
        color3 = [1.0, 0.5, 0.5];   // Light red   // Light grey
    } else if (colorChoice == 'g') {
        color1 = [0.0, 0.5, 0.0];   // Dark green
        color2 = [0.25, 0.75, 0.25]; // Medium green
        color3 = [0.5, 1.0, 0.5];   // Light green
    } else if (colorChoice == 'darkGreen') {
        color1 = [0.0, 0.3, 0.0];   // Dark green
        color2 = [0.1, 0.4, 0.1];   // Medium dark green
        color3 = [0.2, 0.5, 0.2];   // Lighter dark green
    } else {
        color1 = [0.0, 0.0, 0.5];   // Dark blue
        color2 = [0.25, 0.25, 0.75]; // Medium blue
        color3 = [0.5, 0.5, 1.0];   // Light blue
    }

    // Loop through each triangle and alternate between the three colors
    for (var i = 0; i < g_vertex_count / 3; i++) {
        // Cycle through color1, color2, and color3
        var currentColor;
        if (i % 3 === 0) {
            currentColor = color1;
        } else if (i % 3 === 1) {
            currentColor = color2;
        } else {
            currentColor = color3;
        }

        // Assign the chosen color to all three vertices of the triangle
        for (var vert = 0; vert < 3; vert++) {
            colors.push(...currentColor);
        }
    }

    console.log("colors", colors);
    return colors;
}


// How far in the X and Z directions the grid should extend
// Recall that the camera "rests" on the X/Z plane, since Z is "out" from the camera
const GRID_X_RANGE = 100
const GRID_Z_RANGE = 100
function build_grid_attributes(grid_row_spacing, grid_column_spacing) {
    if (grid_row_spacing < 1 || grid_column_spacing < 1) {
        console.error("Cannot have grid spacing less than 1")
        return [[], []]
    }
    var mesh = []

    // Construct the rows
    for (var x = -GRID_X_RANGE; x < GRID_X_RANGE; x += grid_row_spacing) {
        // two vertices for each line
        // one at -Z and one at +Z
        mesh.push(x, 0, -GRID_Z_RANGE)
        mesh.push(x, 0, GRID_Z_RANGE)
    }

    // Construct the columns extending "outward" from the camera
    for (var z = -GRID_Z_RANGE; z < GRID_Z_RANGE; z += grid_row_spacing) {
        // two vertices for each line
        // one at -Z and one at +Z
        mesh.push(-GRID_X_RANGE, 0, z)
        mesh.push(GRID_X_RANGE, 0, z)
    }

    g_grid_vertex_count = mesh.length / 3

    var mesh_normals = []
    // Add in dummy normals for padding
    for (var i = 0; i < mesh.length / 3; i++) {
        mesh_normals.push(0, 1, 0)
    }

    return [mesh, mesh_normals]
}

function updateNear(amount) {
    label = document.getElementById('near')
    label.textContent = `Near: ${Number(amount).toFixed(2)}`
    g_near = Number(amount)
}

function updateFar(amount) {
    label = document.getElementById('far')
    label.textContent = `Far: ${Number(amount).toFixed(2)}`
    g_far = Number(amount)
}

function updateFOVY(amount) {
    label = document.getElementById('fovy')
    label.textContent = `FOVY: ${Number(amount).toFixed(2)}`
    g_fovy = Number(amount)
}

function updateAspect(amount) {
    label = document.getElementById('aspect')
    label.textContent = `Aspect: ${Number(amount).toFixed(2)}`
    g_aspect = Number(amount)
}

// Add variables to store camera position and direction
var cameraX = 0;
var cameraY = 0;
var cameraZ = 5; // Initial Z position to move forward and backward along Z-axis
var cameraDirection = { x: 0, y: 0, z: -1 }; // Initial direction facing along -Z

// Add movement speed variable
var moveSpeed = 0.1;
var verticalSpeed = 0.1; 

// Function to handle keydown events for WASD controls
function setupControls() {
    window.addEventListener('keydown', (event) => {
        switch (event.key) {
            case 'w': // Move forward
                cameraX += cameraDirection.x * moveSpeed;
                cameraZ += cameraDirection.z * moveSpeed;
                break;
            case 's': // Move backward
                cameraX -= cameraDirection.x * moveSpeed;
                cameraZ -= cameraDirection.z * moveSpeed;
                break;
            case 'a': // Strafe left
                cameraX += cameraDirection.z * moveSpeed;
                cameraZ -= cameraDirection.x * moveSpeed;
                break;
            case 'd': // Strafe right
                cameraX -= cameraDirection.z * moveSpeed;
                cameraZ += cameraDirection.x * moveSpeed;
                break;
            case ' ': // Move up (Space key)
                cameraY += verticalSpeed;
                break;
            case 'Shift': // Move down (Shift key)
                cameraY -= verticalSpeed;
                break;
        }
        updateCameraMatrix();
    });
}

// Function to update the camera matrix based on the new camera position
function updateCameraMatrix() {
    g_camera_matrix.setLookAt(
        cameraX, cameraY, cameraZ, // Camera position
        cameraX + cameraDirection.x, cameraY + cameraDirection.y, cameraZ + cameraDirection.z, // Look-at position
        0, 1, 0 // Up vector
    );
}

var isPerspective = true; // Starts with perspective mode


function updateProjectionMatrix() {

    let projectionMatrix;
    if (isPerspective) {
        // Set perspective projection matrix
        projectionMatrix = new Matrix4().setPerspective(g_fovy, g_aspect, g_near, g_far);
    } else {
        // Set orthographic projection matrix
        const orthoSize = 5; // Size of the orthographic view, can be adjusted
        projectionMatrix = new Matrix4().setOrtho(-orthoSize * g_aspect, orthoSize * g_aspect, -orthoSize, orthoSize, g_near, g_far);
    }
    gl.uniformMatrix4fv(g_projection_ref, false, projectionMatrix.elements);
}

// Function to handle projection toggle
function setupProjectionToggle() {
    const toggleButton = document.getElementById('toggleProjection');
    toggleButton.addEventListener('click', () => {
        // Toggle projection mode
        isPerspective = !isPerspective;
        updateProjectionMatrix(); // Update projection matrix based on the new mode
    });
}

// Rotation angles (in degrees)
var yaw = 0; // Rotation around the Y-axis (left/right)
var pitch = 0; // Rotation around the X-axis (up/down)
var rotationSpeed = 1; // Speed of rotation per key press

// Function to handle arrow key events for camera rotation
function setupArrowKeyControls() {
    window.addEventListener('keydown', (event) => {
        switch (event.key) {
            case 'ArrowUp': // Look up
                pitch = Math.min(pitch + rotationSpeed, 89); // Limit pitch to prevent flipping
                break;
            case 'ArrowDown': // Look down
                pitch = Math.max(pitch - rotationSpeed, -89);
                break;
            case 'ArrowLeft': // Turn left
                yaw -= rotationSpeed;
                break;
            case 'ArrowRight': // Turn right
                yaw += rotationSpeed;
                break;
        }
        updateCameraDirection();
        updateCameraMatrix();
    });
}

// Function to update the camera's direction based on yaw and pitch angles
function updateCameraDirection() {
    const radYaw = (yaw * Math.PI) / 180;
    const radPitch = (pitch * Math.PI) / 180;

    // Calculate new direction based on yaw and pitch
    cameraDirection.x = Math.cos(radPitch) * Math.sin(radYaw);
    cameraDirection.y = Math.sin(radPitch);
    cameraDirection.z = -Math.cos(radPitch) * Math.cos(radYaw);
}

async function addObject (mesh, vertex_count, normals=null, isTex = false, texCoord=null, nodeName, color=null, children=null, rotate=null, scale=null, translate=null) {
    
    let buffer = gl.createBuffer()
    if (!buffer) {
        console.log(`Failed to create ${nodeName} vertex buffer`)
        return -1
    }

    // let colorAttribute = build_color_attributes(vertex_count, color)
    let attribute = mesh;
    if (normals != null){
        attribute = attribute.concat(normals)
    } 
    if (texCoord != null ){
        console.log('Texture Coordinates:', texCoord);
        attribute = attribute.concat(texCoord)
    }
    
    console.log(`${nodeName} attribute`, attribute)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(attribute), gl.STATIC_DRAW);

    finalColor = color != null ? color : [0.8, 0.5, 0.2]
    var node = new SceneNode(buffer, vertex_count, finalColor, isTex);
    

    if(children){
        console.log(`${nodeName}'s children is ${children}`)
        children.forEach(child => {
            node.addChild(child)
        });
    }
   
    // Apply transformations in order: translate, scale, then rotate
    if (translate) {
        console.log("translating")
        node.localMatrix.concat(new Matrix4().setTranslate(translate.x, translate.y, translate.z));
    }

    if (scale) {
        console.log("scaling")

        node.localMatrix.concat(new Matrix4().setScale(scale.x, scale.y, scale.z));
    }

    if (rotate) {
        console.log("rotating")

        if (rotate.x) {
            node.localMatrix.concat(new Matrix4().setRotate(rotate.x, 1, 0, 0));
        }
        if (rotate.y) {
            node.localMatrix.concat(new Matrix4().setRotate(rotate.y, 0, 1, 0));
        }
        if (rotate.z) {
            node.localMatrix.concat(new Matrix4().setRotate(rotate.z, 0, 0, 1));
        }
    }

    return node
}

// Global variable for rotation speed
var rotationSpeed = 1;

// Function to set up the rotation speed slider
function setupRotationSpeedControl() {
    const rotationSpeedSlider = document.getElementById('rotationSpeedSlider');
    rotationSpeedSlider.addEventListener('input', (event) => {
        rotationSpeed = parseFloat(event.target.value);
    });
}

async function loadOBJ(filename){
    const objString = await loadOBJFile(filename);  // Provide the correct path to your OBJ file
    if (!objString) {
        console.error(`Failed to load ${filename} OBJ `);
        return;
    } 

    const { mesh, meshNormals, vertexCount, meshVertexSize} = convertOBJtoWebGLMesh(objString);
    console.log("filename", vertexCount)
    return { mesh, meshNormals, vertexCount, meshVertexSize };
}

function updateLightX(amount) {
    label = document.getElementById('lightX')
    label.textContent = `Light X: ${Number(amount).toFixed(2)}`
    g_light_x = Number(amount)
}

function updateLightY(amount) {
    label = document.getElementById('lightY')
    label.textContent = `Light Y: ${Number(amount).toFixed(2)}`
    g_light_y = Number(amount)
}

function updateLightZ(amount) {
    label = document.getElementById('lightZ')
    label.textContent = `Light Z: ${Number(amount).toFixed(2)}`
    g_light_z = Number(amount)
}   
//(C) 2020 Moses Odhiambo
//github.com/badass-techie/Sonic-Dash-Run

"use strict"

let scene, camera, renderer, cube, orbitControl, animationFrame;
let worlds = [], laneWidth = 0.5, glow;
let sonic, sonicAction = "run", sonicHasCrashed = false, currentLane = 0, maxHeight = 0.5, dRot = 45, strafeDuration = 0.5, actionClock = {startTime: undefined, duration: 667}, animations = {run: undefined, roll: undefined, jump: undefined, fall: undefined, dead: undefined};
let obstacles = [], coins = [], coinSize = 0.025, rows = 9, gap = 4;
let score = 0, scoreLabel, level = 1, levelLabel;
let jumpSound, crashSound, deadSound, levelUpSound;
let clock = new THREE.Clock(), delta = 0, speed = 3, animationMixer, strafingMixer, rotationMixer;
let stats;

//initialize
const init = () => {
    stats = new Stats();
    stats.showPanel(0);
    //document.body.appendChild(stats.dom);
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog( 0xa9f5f2, 0.001, 72);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.001, 1000);
    camera.position.set(0, 0.67, 6.1);
    loadSounds();
    renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0xa9f5f2, 1);
    document.body.appendChild(renderer.domElement);
    //populate scene
    addLight();
    for (let i = 0; i < 4; ++i){
        worlds.push(new World());
        worlds[i].position.z = -12 * i;
        scene.add(worlds[i]);
    }
    addSea();
    for (let i = 0; i > -rows; --i) addToPath(gap*i);
    spawnSonic({x: 0, y: 0, z: 4.8}, 0.021);
    ////////////////
    addScore();
    addLevel();
    render();
    // orbitControl = new THREE.OrbitControls(camera, renderer.domElement); //helper to rotate around in scene
    // orbitControl.addEventListener('change', render);
    // orbitControl.enableZoom = true;
}

//classes
//adds world
class World{
    constructor(){
        this.obj = new THREE.Group();
        this.clouds = [];
        this.cloudGeometries = [];
        this.poleGeometries = [];
        //adds the ground
        let groundGeometry = new THREE.BoxGeometry(2, 2, 12, 8, 1, 1);
        groundGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, -groundGeometry.parameters.height/2, 0));
        groundGeometry.faces.forEach(face => {
            face.color.setHex(0x00b300);
        });
        //colors the tracks
        for (let i = 6; i <= 9; ++i) groundGeometry.faces[i].color.setHex(0x00cc00);
        for (let i = 14; i <= 17; ++i) groundGeometry.faces[i].color.setHex(0x00cc00);
        let groundMaterial = new THREE.MeshBasicMaterial({ vertexColors: THREE.FaceColors });
        let ground = new THREE.Mesh(new THREE.BufferGeometry().fromGeometry(groundGeometry), groundMaterial);
        this.obj.add(ground);
        //adds poles on the sides
        for(let xPos = -1; xPos <= 1; xPos+=2){
            //adds vertically
            for (let yPos = 0.2; yPos > 0; yPos -= 0.1){
                let geometry = new THREE.CylinderBufferGeometry(0.01, 0.01, 12, 8, 1);
                geometry.applyMatrix(new THREE.Matrix4().makeRotationX(THREE.Math.degToRad(90)));
                geometry.applyMatrix(new THREE.Matrix4().makeTranslation(xPos, yPos, 0));
                rotateAbout(geometry, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1).normalize(), new THREE.Vector3(xPos, 0, 0), xPos*THREE.Math.degToRad(-15));
                this.poleGeometries.push(geometry);
            }
            //adds horizontally
            for (let zPos = -groundGeometry.parameters.depth/2; zPos < groundGeometry.parameters.depth/2; zPos+=groundGeometry.parameters.depth/4){
                let geometry = new THREE.CylinderBufferGeometry(0.01, 0.01, 0.4, 8, 1);
                geometry.applyMatrix(new THREE.Matrix4().makeRotationZ(xPos*THREE.Math.degToRad(-15)));
                geometry.applyMatrix(new THREE.Matrix4().makeTranslation(xPos, 0, zPos));
                this.poleGeometries.push(geometry);
            }
        }
        this.obj.add(new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(this.poleGeometries), new THREE.MeshBasicMaterial({ color: 0x4d2600 })));
        //adds bricks on the side
        for(let zPos = -4; zPos < 6; zPos+=3){
            let geometry = new THREE.BoxGeometry(0.4, 0.6, 0.4, 4, 12, 4);
            //textures the bricks with code
            let darkBrown = 0x804000, lightBrown = 0xc68c53;
            for(let i = 0; i < geometry.faces.length; i+=4){
                let option = (Math.trunc(i/8)%2)? lightBrown : darkBrown;
                geometry.faces[i].color.setHex(option);
                geometry.faces[i+1].color.setHex(option);
            }
            for(let i = 2; i < geometry.faces.length; i+=4){
                let option = (Math.trunc(i/8)%2)? darkBrown : lightBrown;
                geometry.faces[i].color.setHex(option);
                geometry.faces[i+1].color.setHex(option);
            }
            for(let i = 192; i < 224; ++i){
                geometry.faces[i].color.setHex(0x00b300);
            }
            ///////////////////////////////
            let material = new THREE.MeshBasicMaterial({ vertexColors: THREE.FaceColors });
            let bricks = new THREE.Mesh(new THREE.BufferGeometry().fromGeometry(geometry), material);
            bricks.position.set(!((zPos + 4)%6)? -1: 1, -0.08, zPos);
            this.obj.add(bricks);
            //adds trees on top
            let tree = new PalmTree(1.1);
            tree.position.set(!((zPos + 4)%6)? -1: 1, 0.22, zPos);
            this.obj.add(tree);
        }
        //adds rocks
        for(let zPos = -3; zPos <= 6; zPos+=3){
            let geometry = new THREE.DodecahedronGeometry(0.15, 1);
            geometry.applyMatrix(new THREE.Matrix4().makeScale(1, 2.4, 1));
            jitter(geometry, 0.015);
            let material = new THREE.MeshBasicMaterial({ color: 0x999999 });
            let rock = new THREE.Mesh(new THREE.BufferGeometry().fromGeometry(geometry), material);
            rock.position.set(((zPos + 3)%6)? -1: 1, 0, zPos);
            this.obj.add(rock);
        }
        //creates clouds
        this.createCloud({x: -0.2, y: 1.2, z: 5.5, size: 0.21});
        this.createCloud({x: 0.5, y: 1, z: 4.5, size: 0.15});
        this.createCloud({x: -0.6, y: 1, z: 4.5, size: 0.2});
        this.createCloud({x: 0.5, y: 1, z: 4.5, size: 0.15});
        this.createCloud({x: 0.2, y: 1.2, z: 4, size: 0.2});
        this.createCloud({x: -0.4, y: 1.25, z: 3, size: 0.24});
        this.createCloud({x: 0.2, y: 1.6, z: 2, size: 0.24});
        this.createCloud({x: -0.3, y: 1.8, z: 1.5, size: 0.2});
        this.createCloud({x: 0, y: 1, z: 0.5, size: 0.21});
        this.createCloud({x: 0, y: 1.5, z: -0.5, size: 0.21});
        this.createCloud({x: -0.5, y: 1.4, z: -1, size: 0.24});
        this.createCloud({x: 0.67, y: 1.6, z: -2, size: 0.24});
        this.createCloud({x: 0.33, y: 1.2, z: -2.5, size: 0.2});
        this.createCloud({x: -0.33, y: 1, z: -4, size: 0.15});
        this.createCloud({x: -0.6, y: 1, z: -5, size: 0.2});
        this.createCloud({x: 0.5, y: 1, z: -5, size: 0.15});
        this.addClouds();
        return this.obj;
    }
    //creates clouds
    createCloud(attributes){
        const {x, y, z, size} = attributes;
        let cloud = new Cloud(size);
        cloud.position.set(x, y + 0.5, z);
        this.clouds.push(cloud);
    }
    //adds clouds to the world
    addClouds(){
        this.clouds.forEach(cloud => {
            cloud.geometry.applyMatrix(new THREE.Matrix4().makeScale(cloud.scale.x, cloud.scale.y, cloud.scale.z));
            cloud.geometry.applyMatrix(new THREE.Matrix4().makeTranslation(cloud.position.x, cloud.position.y, cloud.position.z));
            this.cloudGeometries.push(cloud.geometry);
        });
        this.obj.add(new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(this.cloudGeometries), this.clouds[1].material));
    }
};

//creates palm trees
class PalmTree{
    constructor(size = 1){
        this.obj = new THREE.Group();
        this.leaves = [];
        this.leafGeometries = [];
        let trunkGeometry = new THREE.CylinderBufferGeometry(0.005, 0.02, 0.36, 8, 1);
        let trunkMaterial = new THREE.MeshBasicMaterial({ color: 0x4d2600 });
        let trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.set(0, trunkGeometry.parameters.height/2, 0);
        this.obj.add(trunk);
        for (let phi = 0; phi < 360; phi += 45) {
            let leafGeometry = new THREE.SphereBufferGeometry(0.1, 3, 12, 0, Math.PI/12);
            leafGeometry.applyMatrix(new THREE.Matrix4().makeScale(0.7, 1, 1));
            leafGeometry.applyMatrix(new THREE.Matrix4().makeRotationZ(THREE.Math.degToRad(-90)));
            let leafMaterial = new THREE.MeshBasicMaterial({ color: 0x00cc00, side: THREE.DoubleSide });
            let leaf = new THREE.Mesh(leafGeometry, leafMaterial);
            leaf.position.set(leafGeometry.parameters.radius, trunkGeometry.parameters.height, 0);
            rotateAbout(leaf.geometry, leaf.position, new THREE.Vector3(0, 1, 0).normalize(), new THREE.Vector3(leaf.position.x - leaf.geometry.parameters.radius, leaf.position.y, leaf.position.z), THREE.Math.degToRad(phi));
            this.leaves.push(leaf);
        }
        this.leaves.forEach(leaf => {
            leaf.geometry.applyMatrix(new THREE.Matrix4().makeScale(leaf.scale.x, leaf.scale.y, leaf.scale.z));
            leaf.geometry.applyMatrix(new THREE.Matrix4().makeTranslation(leaf.position.x, leaf.position.y, leaf.position.z));
            this.leafGeometries.push(leaf.geometry);
        });
        this.obj.add(new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries(this.leafGeometries), this.leaves[1].material));
        this.obj.scale.set(size, size, size);
        return this.obj;
    }
};

//creates clouds
class Cloud{
    constructor(size = 0.2, cols = 12, rows = 12){
        let material = new THREE.MeshBasicMaterial({ color: 0xd9dfe2 });
        let sphere1Geometry = new THREE.SphereBufferGeometry(0.18, rows, cols);
        sphere1Geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -0.1));
        let sphere2Geometry = new THREE.SphereBufferGeometry(0.28, rows, cols);
        sphere2Geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -0.275));
        let sphere3Geometry = new THREE.SphereBufferGeometry(0.28, rows, cols);
        sphere3Geometry.applyMatrix(new THREE.Matrix4().makeTranslation(-0.18, 0, -0.4));
        let sphere4Geometry = new THREE.SphereBufferGeometry(0.28, rows, cols);
        sphere4Geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0.18, 0, -0.4));
        let sphere5Geometry = new THREE.SphereBufferGeometry(0.28, rows, cols);
        sphere5Geometry.applyMatrix(new THREE.Matrix4().makeTranslation(-0.18, 0, -0.76));
        let sphere6Geometry = new THREE.SphereBufferGeometry(0.28, rows, cols);
        sphere6Geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0.18, 0, -0.76));
        let sphere7Geometry = new THREE.SphereBufferGeometry(0.28, rows, cols);
        sphere7Geometry.applyMatrix(new THREE.Matrix4().makeTranslation(-0.05, 0.15, -0.5));
        let sphere8Geometry = new THREE.SphereBufferGeometry(0.35, rows, cols);
        sphere8Geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0.05, 0.15, -0.63));
        let sphere9Geometry = new THREE.SphereBufferGeometry(0.25, rows, cols);
        sphere9Geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -0.985));
        this.obj = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries([sphere1Geometry, sphere2Geometry, sphere3Geometry, sphere4Geometry, sphere5Geometry, sphere6Geometry, sphere7Geometry, sphere8Geometry, sphere9Geometry]), material);
        this.obj.scale.set(size, size, size);
        return this.obj;
    }
};

//creates road blocks
class RoadBlock{
    constructor(){
        this.obj = new THREE.Group();
        let deviation = 21;
        let geo1 = new THREE.BoxBufferGeometry(0.05, 1.2, 0.025);
        rotateAbout(geo1, new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0).normalize(), new THREE.Vector3(0, 0.6, 0), -THREE.Math.degToRad(deviation));
        geo1.applyMatrix(new THREE.Matrix4().makeTranslation(0.2, 0, 0));
        let geo2 = new THREE.BoxBufferGeometry(0.05, 1.2, 0.025);
        rotateAbout(geo2, new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0).normalize(), new THREE.Vector3(0, 0.6, 0), -THREE.Math.degToRad(deviation));
        geo2.applyMatrix(new THREE.Matrix4().makeTranslation(-0.2, 0, 0));
        let geo3 = new THREE.BoxBufferGeometry(0.05, 1.2, 0.025);
        rotateAbout(geo3, new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0).normalize(), new THREE.Vector3(0, 0.6, 0), THREE.Math.degToRad(deviation));
        geo3.applyMatrix(new THREE.Matrix4().makeTranslation(0.2, 0, 0));
        let geo4 = new THREE.BoxBufferGeometry(0.05, 1.2, 0.025);
        rotateAbout(geo4, new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0).normalize(), new THREE.Vector3(0, 0.6, 0), THREE.Math.degToRad(deviation));
        geo4.applyMatrix(new THREE.Matrix4().makeTranslation(-0.2, 0, 0));
        this.obj.add(new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries([geo1, geo2, geo3, geo4]), new THREE.MeshBasicMaterial({ color: 0x777777 })));
        let geo5 = new THREE.BoxGeometry(0.5, 0.1, 0.025, 5, 1, 1);
        geo5.faces.forEach(face => {
            face.color.setHex(0xffff00);
        });
        for (let i = 25; i <= 43; i+=4){
            geo5.faces[i].color.setHex(0x000000);
            geo5.faces[i+1].color.setHex(0x000000);
        }   //colors some faces black
        let geo6 = geo5.clone();
        let geo7 = geo5.clone();
        let geo8 = geo5.clone();
        let geo9 = geo5.clone();
        let geo10 = geo5.clone();
        geo5.applyMatrix(new THREE.Matrix4().makeRotationX(-THREE.Math.degToRad(deviation)));
        geo6.applyMatrix(new THREE.Matrix4().makeRotationX(-THREE.Math.degToRad(deviation)));
        geo7.applyMatrix(new THREE.Matrix4().makeRotationX(-THREE.Math.degToRad(deviation)));
        geo8.applyMatrix(new THREE.Matrix4().makeRotationX(THREE.Math.degToRad(deviation)));
        geo9.applyMatrix(new THREE.Matrix4().makeRotationX(THREE.Math.degToRad(deviation)));
        geo10.applyMatrix(new THREE.Matrix4().makeRotationX(THREE.Math.degToRad(deviation)));
        geo5.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.1, geo1.parameters.depth));
        geo6.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.3, geo1.parameters.depth));
        geo7.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.5, geo1.parameters.depth));
        geo8.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.1, -geo1.parameters.depth));
        geo9.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.3, -geo1.parameters.depth));
        geo10.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.5, -geo1.parameters.depth));
        geo5.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 0.5*Math.tan(THREE.Math.degToRad(deviation))));
        geo6.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 0.3*Math.tan(THREE.Math.degToRad(deviation))));
        geo7.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 0.1*Math.tan(THREE.Math.degToRad(deviation))));
        geo8.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -0.5*Math.tan(THREE.Math.degToRad(deviation))));
        geo9.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -0.3*Math.tan(THREE.Math.degToRad(deviation))));
        geo10.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -0.1*Math.tan(THREE.Math.degToRad(deviation))));
        this.obj.add(new THREE.Mesh(geo5, new THREE.MeshBasicMaterial({ vertexColors: THREE.FaceColors })));
        this.obj.add(new THREE.Mesh(geo6, new THREE.MeshBasicMaterial({ vertexColors: THREE.FaceColors })));
        this.obj.add(new THREE.Mesh(geo7, new THREE.MeshBasicMaterial({ vertexColors: THREE.FaceColors })));
        this.obj.add(new THREE.Mesh(geo8, new THREE.MeshBasicMaterial({ vertexColors: THREE.FaceColors })));
        this.obj.add(new THREE.Mesh(geo9, new THREE.MeshBasicMaterial({ vertexColors: THREE.FaceColors })));
        this.obj.add(new THREE.Mesh(geo10, new THREE.MeshBasicMaterial({ vertexColors: THREE.FaceColors })));
        //adds coins
        for (let i = -7; i <= 7; i+=2){
            if (i > -4 && i < 4) continue;
            let zPos = i/4, rot = 90*i/7, index = (i+7)/2;
            let coin = new Coin(rot);
            coin.position.set(0, coinSize, zPos);
            this.obj.add(coin);
        }
        this.obj.userData = {type: "RoadBlock"};
        return this.obj;
    }
}

//creates smaller road blocks
class SmallRoadBlock{
    constructor(){
        this.obj = new THREE.Group();
        let geo1 = new THREE.BoxBufferGeometry(0.05, 0.6, 0.025);
        geo1.applyMatrix(new THREE.Matrix4().makeTranslation(0.2, geo1.parameters.height/2, 0));
        let geo2 = new THREE.BoxBufferGeometry(0.05, 0.6, 0.025);
        geo2.applyMatrix(new THREE.Matrix4().makeTranslation(-0.2, geo2.parameters.height/2, 0));
        this.obj.add(new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries([geo1, geo2]), new THREE.MeshBasicMaterial({ color: 0x777777 })));
        let geo3 = new THREE.BoxGeometry(0.5, 0.1, 0.025, 5, 1, 1);
        geo3.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.5, geo1.parameters.depth));
        geo3.faces.forEach(face => {
            face.color.setHex(0xffff00);
        });
        for (let i = 25; i <= 43; i+=4){
            geo3.faces[i].color.setHex(0x000000);
            geo3.faces[i+1].color.setHex(0x000000);
        }   //colors some faces black
        let geo4 = geo3.clone();
        geo4.applyMatrix(new THREE.Matrix4().makeTranslation(0, -0.2, 0));
        this.obj.add(new THREE.Mesh(geo3, new THREE.MeshBasicMaterial({ vertexColors: THREE.FaceColors })));
        this.obj.add(new THREE.Mesh(geo4, new THREE.MeshBasicMaterial({ vertexColors: THREE.FaceColors })));
        //adds coins
        for (let i = -7; i <= 7; i+=2){
            let zPos = i/4, rot = 90*i/7, index = (i+7)/2;
            let coin = new Coin(rot);
            coin.position.set(0, coinSize, zPos);
            this.obj.add(coin);
        }
        this.obj.userData = {type: "SmallRoadBlock"};
        return this.obj;
    }
}

//creates traffic cones
class Cone{
    constructor(){
        this.obj = new THREE.Group();
        let orange = 0x993d00, white = 0xaaaaaa;
        let geo1 = new THREE.BoxBufferGeometry(laneWidth, 0.03, laneWidth/2);
        let mat1 = new THREE.MeshLambertMaterial({ color: orange });
        geo1.applyMatrix(new THREE.Matrix4().makeTranslation(0, geo1.parameters.height/2, 0));
        this.obj.add(new THREE.Mesh(geo1, mat1));
        let geo2 = new THREE.CylinderGeometry(0.03, 0.1, 0.24, 16, 3);
        geo2.applyMatrix(new THREE.Matrix4().makeTranslation(0.125, geo2.parameters.height/2 + geo1.parameters.height, 0));
        geo2.faces.forEach(face => {
            face.color.setHex(orange);
        });
        for (let i = 2; i <= 92; i+=6){
            geo2.faces[i].color.setHex(white);
            geo2.faces[i+1].color.setHex(white);
        }   //colors some faces white
        let mat2 = new THREE.MeshLambertMaterial({ vertexColors: THREE.FaceColors });
        this.obj.add(new THREE.Mesh(geo2, mat2));
        let geo3 = new THREE.CylinderGeometry(0.03, 0.1, 0.24, 16, 3);
        geo3.applyMatrix(new THREE.Matrix4().makeTranslation(-0.125, geo3.parameters.height/2 + geo1.parameters.height, 0));
        geo3.faces.forEach(face => {
            face.color.setHex(orange);
        });
        for (let i = 2; i <= 92; i+=6){
            geo3.faces[i].color.setHex(white);
            geo3.faces[i+1].color.setHex(white);
        }   //colors some faces white
        let mat3 = new THREE.MeshLambertMaterial({ vertexColors: THREE.FaceColors });
        this.obj.add(new THREE.Mesh(geo3, mat3));
        //adds coins
        let heights = [coinSize, coinSize, 0.3, 0.5, 0.5, 0.3, coinSize, coinSize]
        for (let i = -7; i <= 7; i+=2){
            let zPos = i/4, rot = 90*i/7, index = (i+7)/2;
            let coin = new Coin(rot);
            coin.position.set(0, heights[index], zPos);
            this.obj.add(coin);
        }
        this.obj.userData = {type: "Cone"};
        return this.obj
    }
};

//creates spikes
class Spike{
    constructor(){
        this.obj = new THREE.Group()
        let material = new THREE.MeshLambertMaterial({ color: 0x3e4141 });
        let geo1 = new THREE.BoxBufferGeometry(laneWidth, 0.03, 0.1);
        geo1.applyMatrix(new THREE.Matrix4().makeTranslation(0, geo1.parameters.height/2, 0));
        let geo2 = new THREE.ConeBufferGeometry(0.036, 0.09, 12, 1);
        geo2.applyMatrix(new THREE.Matrix4().makeTranslation(0, geo2.parameters.height/2 + geo1.parameters.height, 0));
        let geo3 = new THREE.ConeBufferGeometry(0.036, 0.09, 12, 1);
        geo3.applyMatrix(new THREE.Matrix4().makeTranslation(0.1, geo3.parameters.height/2 + geo1.parameters.height, 0));
        let geo4 = new THREE.ConeBufferGeometry(0.036, 0.09, 12, 1);
        geo4.applyMatrix(new THREE.Matrix4().makeTranslation(0.2, geo4.parameters.height/2 + geo1.parameters.height, 0));
        let geo5 = new THREE.ConeBufferGeometry(0.036, 0.09, 12, 1);
        geo5.applyMatrix(new THREE.Matrix4().makeTranslation(-0.1, geo5.parameters.height/2 + geo1.parameters.height, 0));
        let geo6 = new THREE.ConeBufferGeometry(0.036, 0.09, 12, 1);
        geo6.applyMatrix(new THREE.Matrix4().makeTranslation(-0.2, geo6.parameters.height/2 + geo1.parameters.height, 0));
        this.obj.add(new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries([geo1, geo2, geo3, geo4, geo5, geo6]), material));
        //adds coins
        let heights = [coinSize, coinSize, 0.3, 0.5, 0.5, 0.3, coinSize, coinSize]
        for (let i = -7; i <= 7; i+=2){
            let zPos = i/4, rot = 90*i/7, index = (i+7)/2;
            let coin = new Coin(rot);
            coin.position.set(0, heights[index], zPos);
            this.obj.add(coin);
        }
        this.obj.userData = {type: "Spike"};
        return this.obj;
    }
};

//creates coins
class Coin{
    constructor(rotation = 0){
        let geo = new THREE.TorusBufferGeometry(coinSize, coinSize*0.4, 10, 20);
        geo.applyMatrix(new THREE.Matrix4().makeRotationY(THREE.Math.degToRad(rotation)));
        let mat = new THREE.MeshLambertMaterial({color: 0xccad00});
        return new THREE.Mesh(geo, mat);
    }
}

//functions
//starts the game
const startGame = () => {
    swal({
        title: "Sonic Dash Run",
        text: (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) ? 'Swipe up to jump, down to roll, and left/right to switch lanes.' : 'Use the arrow keys to move.\nPress up to jump, down to roll, and left or right to switch lanes.',
        button: "Play",
        closeOnClickOutside: false,
        closeOnEsc: false,
    }).then(() => {
        clock.start();
        update();
    });
}

//restarts game
const restartGame = () => {
    swal({
        title: "Uh-Oh!",
        text: "Sonic crashed.",
        buttons: {
            confirm: "Play again",
            cancel: "Quit"
        },
        closeOnClickOutside: false,
        closeOnEsc: false
    }).then(val => {
        if (val) {
            document.location.reload(false);
        } else{
            let contents = document.createElement("div");
            contents.innerHTML = `<p>...</p><p>\u00A9 ${new Date().getFullYear()} Moses Odhiambo</p><p><a href = "https://github.com/badass-techie">my projects</a></p>`;
            swal({
                content: contents,
                closeOnClickOutside: false,
                closeOnEsc: false,
                button: false
            });
        }
    });
}

//loads sound effects
const loadSounds = () => {
    let listener = new THREE.AudioListener();
    camera.add(listener);
    let audioLoader = new THREE.AudioLoader();
    jumpSound = new THREE.Audio( listener );
    audioLoader.load( 'assets/jump.mp3', buffer => {
        jumpSound.setBuffer( buffer );
        jumpSound.setLoop( false );
        jumpSound.setVolume( 1 );
    });
    crashSound = new THREE.Audio( listener );
    audioLoader.load( 'assets/crash.mp3', buffer => {
        crashSound.setBuffer( buffer );
        crashSound.setLoop( false );
        crashSound.setVolume( 1 );
    });
    levelUpSound = new THREE.Audio( listener );
    audioLoader.load( 'assets/levelUp.mp3', buffer => {
        levelUpSound.setBuffer( buffer );
        levelUpSound.setLoop( false );
        levelUpSound.setVolume( 1 );
    });
    deadSound = new THREE.Audio( listener );
    audioLoader.load( 'assets/dead.mp3', buffer => {
        deadSound.setBuffer( buffer );
        deadSound.setLoop( false );
        deadSound.setVolume( 0.5 );
    });
}

//lights up the scene
const addLight = () => {
    //ambient lighting
    let light = new THREE.HemisphereLight(0xffffff, 0x000000, 2);
    scene.add(light);
    //the sun
    let sunGeometry = new THREE.SphereBufferGeometry(0.25, 12, 12);
    let sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff99, transparent: true, opacity: 0.8 });
    let sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.position.set(-2, 4, -3);
    scene.add(sun);
    let glowGeometry = new THREE.SphereBufferGeometry(0.54, 12, 12);
    let glowMaterial = new THREE.ShaderMaterial({
        uniforms: {
            viewVector: {type: "v3", value: camera.position}
        },
        vertexShader: document.getElementById('vertexShader').textContent,
        fragmentShader: document.getElementById('fragmentShader').textContent,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true
    });
    glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.set(sun.position.x, sun.position.y, sun.position.z);
    scene.add(glow);
}

//adds the sea
const addSea = () => {
    let seaGeometry = new THREE.PlaneBufferGeometry(1000, 1000);
    seaGeometry.applyMatrix(new THREE.Matrix4().makeRotationX(THREE.Math.degToRad(90)));
    seaGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, -2, -seaGeometry.parameters.height/2+10));
    let seaMaterial = new THREE.MeshBasicMaterial({ color: 0x2eccfa, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    let sea = new THREE.Mesh(seaGeometry, seaMaterial);
    scene.add(sea);
}

//adds Sonic to the scene
const spawnSonic = (pos, scale) => {
    let loader = new THREE.GLTFLoader();
    loader.load("assets/sonic.glb", gltf => {
        sonic = gltf.scene.children[0];
        sonic.applyMatrix(new THREE.Matrix4().makeRotationY(THREE.Math.degToRad(180)));
        sonic.applyMatrix(new THREE.Matrix4().makeScale(scale, scale, scale));
        sonic.position.set(pos.x, pos.y, pos.z);
        //sonic.add(new THREE.AxesHelper(20));  //show axes
        scene.add(sonic);
        //makes Sonic run
        animationMixer = new THREE.AnimationMixer(sonic);
        animations.run = animationMixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, "Walk"));
        animations.roll = animationMixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, "Spin"));
        animations.jump = animationMixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, "Up"));
        animations.fall = animationMixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, "Fall"));
        animations.dead = animationMixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, "Dead"));      
        animations.run.play();
        //start game
        startGame();
    });
}

//makes sonic jump, run, roll, strafe, etc
const monitorActions = (delta) => {
    if (sonicAction === "jump"){
        if ((1000 * clock.getElapsedTime()) - actionClock.startTime < actionClock.duration/2){
            sonic.position.y += delta*(1000*maxHeight/(actionClock.duration/2));    //enables framerate independence
            animations.run.stop();
            animations.jump.play();
        } else {
            if (sonic.position.y >= 0) sonic.position.y -= delta*(1000*maxHeight/(actionClock.duration/2));  //makes sure sonic doesn't fall beyond 0
            animations.jump.stop();
            animations.fall.play();
        }
    }
}

//triggers the jump action
const jump = () => {
    if (sonicAction === "run"){
        sonicAction = "jump";
        jumpSound.play();
        setTimeout(() => {
            sonicAction = "run";
            animations.fall.stop();
            animations.run.play();
        }, actionClock.duration);
        actionClock.startTime = 1000*clock.getElapsedTime();
    }
}

//triggers the roll action
const roll = () => {
    if (sonicAction === "run"){
        sonicAction = "roll";
        jumpSound.play();
        animations.run.stop();
        animations.roll.play();
        setTimeout(() => {
            sonicAction = "run";
            animations.roll.stop();
            animations.run.play();
        }, actionClock.duration);
    }
}

//triggers the strafe action
const strafe = strafeLeft => {
    if ((currentLane == -1 && strafeLeft == true) || (currentLane == 1 && strafeLeft == false) || sonicAction === "strafe") return;   //makes sure sonic stays in one of the lanes
    let dX = strafeLeft ? -laneWidth : laneWidth;
    let dTheta = strafeLeft ? THREE.Math.degToRad(dRot) : -THREE.Math.degToRad(dRot);
    let movement = new THREE.VectorKeyframeTrack('.position', [0, (strafeDuration)], [sonic.position.x, sonic.position.y, sonic.position.z, sonic.position.x + dX, sonic.position.y, sonic.position.z]);
    let yAxis = new THREE.Vector3(0, 0, 1).normalize();
    let qInitial = new THREE.Quaternion().setFromAxisAngle(yAxis, 0);
    let qFinal = new THREE.Quaternion().setFromAxisAngle(yAxis, dTheta);
    let rotation = new THREE.QuaternionKeyframeTrack('.quaternion', [0, (strafeDuration) / 2, (strafeDuration)], [qInitial.x, qInitial.y, qInitial.z, qInitial.w, qFinal.x, qFinal.y, qFinal.z, qFinal.w, qInitial.x, qInitial.y, qInitial.z, qInitial.w]);
    let movementClip = new THREE.AnimationClip('strafe', (strafeDuration), [movement]);
    let rotationClip = new THREE.AnimationClip('rotate', (strafeDuration), [rotation]);
    strafingMixer = new THREE.AnimationMixer(sonic);
    rotationMixer = new THREE.AnimationMixer(sonic.children[0]);
    strafingMixer.addEventListener('finished', e => {
        sonicAction = "run";
    });
    let movementAnimation = strafingMixer.clipAction(movementClip);
    movementAnimation.setLoop(THREE.LoopOnce);
    movementAnimation.clampWhenFinished = true;
    movementAnimation.play();
    let rotationAnimation = rotationMixer.clipAction(rotationClip);
    rotationAnimation.setLoop(THREE.LoopOnce);
    rotationAnimation.clampWhenFinished = true;
    rotationAnimation.play();
    sonicAction = "strafe";
    currentLane += strafeLeft ? -1 : 1;
}

//adds obstacles to track
const addToPath = zPos => {
    let options = [new RoadBlock(), new SmallRoadBlock(), new Cone(), new Spike()];
    let lanes = [-0.5, 0, 0.5];
    let obstacle = options.splice(Math.floor(Math.random() * options.length), 1)[0]; //picks at random
    obstacle.position.set(lanes.splice(Math.floor(Math.random() * lanes.length), 1)[0], 0, zPos);
    obstacles.push(obstacle);
    scene.add(obstacle);
    //chooses whether to add one more obstacle beside the previous one
    if (Math.random() >= 0.5) {
        let obstacle2 = options.splice(Math.floor(Math.random() * options.length), 1)[0];
        obstacle2.position.set(lanes.splice(Math.floor(Math.random() * lanes.length), 1)[0], 0, zPos);
        obstacles.push(obstacle2);
        scene.add(obstacle2);
    }
}

//repositions obstacles that have gone out of Sonic's field of view
const readdToPath = () => {
    obstacles.forEach(obstacle => {
        if (obstacle.position.z > sonic.position.z+gap) {    //gone beyond field of view
            obstacle.position.z -= rows*gap;
            obstacle.children.forEach(mesh => mesh.visible = true);
            obstacle.position.x = obstacle.position.x==0.5? -0.5 : obstacle.position.x+0.5;
        } else {
            //check collision
            let crashed;
            switch(obstacle.userData.type){
                case "RoadBlock":
                    crashed = sonic.position.x > obstacle.position.x - laneWidth/2 && sonic.position.x < obstacle.position.x + laneWidth/2 && obstacle.position.z + 0.5*Math.tan(THREE.Math.degToRad(21)) > sonic.position.z-0.1 && obstacle.position.z - 0.5*Math.tan(THREE.Math.degToRad(21)) < sonic.position.z+0.1;
                    break;
                case "SmallRoadBlock":
                    crashed = sonic.position.x > obstacle.position.x - laneWidth/2 && sonic.position.x < obstacle.position.x + laneWidth/2 && obstacle.position.z + 0.0375 > sonic.position.z-0.1 && obstacle.position.z - 0.0125 < sonic.position.z+0.1 && sonicAction != "roll";
                    break;
                case "Cone":
                    crashed = sonic.position.x > obstacle.position.x - laneWidth/2 && sonic.position.x < obstacle.position.x + laneWidth/2 && obstacle.position.z + 0.125 > sonic.position.z-0.1 && obstacle.position.z - 0.125 < sonic.position.z+0.1 && sonicAction != "jump";
                    break;
                case "Spike":
                    crashed = sonic.position.x > obstacle.position.x - laneWidth/2 && sonic.position.x < obstacle.position.x + laneWidth/2 && obstacle.position.z + 0.05 > sonic.position.z-0.1 && obstacle.position.z - 0.05 < sonic.position.z+0.1 && sonicAction != "jump";
                    break;
            }
            if (crashed){
                animations.run.stop();
                animations.jump.stop();
                animations.roll.stop();
                sonic.position.y = 0;
                animations.dead.play();
                sonicHasCrashed = true;
                crashSound.play();
                setTimeout(() => {
                    deadSound.play();
                    let interval = setInterval(() => {
                        sonic.rotation.z-=THREE.Math.degToRad(6);
                    }, 20);
                    setTimeout(() => {
                        clearInterval(interval);
                        restartGame();
                    }, 1800);
                }, 800);
            }
        }
    });
}

//appends score to html
const addScore = () => {
    scoreLabel = document.createElement('div');
    scoreLabel.style.position = 'absolute';
    scoreLabel.style.top = '0px';
    scoreLabel.style.left = `${window.innerWidth/2 - 40}px`;
    scoreLabel.style.width = '120px';
    scoreLabel.style.height = '32px';
    scoreLabel.style.fontSize = '20px';
    scoreLabel.style.fontWeight = 'bold';
    scoreLabel.style.color = '#ffffff';
    scoreLabel.style.textShadow = '0px 0px 10px #000000';
    scoreLabel.style.textAlign = 'left';
    scoreLabel.style.lineHeight = '32px';
    scoreLabel.innerHTML = `Coins: ${score}`;
    document.body.appendChild(scoreLabel);
}

//appends level to html
const addLevel = () => {
    levelLabel = document.createElement('div');
    levelLabel.style.position = 'absolute';
    levelLabel.style.top = '0px';
    levelLabel.style.left = '0px';
    levelLabel.style.width = '120px';
    levelLabel.style.height = '32px';
    levelLabel.style.fontSize = '20px';
    levelLabel.style.fontWeight = 'bold';
    levelLabel.style.color = '#ffffff';
    levelLabel.style.textShadow = '0px 0px 10px #000000';
    levelLabel.style.verticalAlign = 'middle';
    levelLabel.style.lineHeight = '32px';
    levelLabel.innerHTML = `Level: ${level}`;
    document.body.appendChild(levelLabel);
}

//moves the vertices of a mesh's geometry to make it less symmetrical
const jitter = (geometry, delta) => geometry.vertices.forEach(v => {
    v.x += map(Math.random(), 0, 1, -delta, delta);
    v.y += map(Math.random(), 0, 1, -delta, delta);
    v.z += map(Math.random(), 0, 1, -delta, delta);
});

//remaps the value provided from the range of [smin,smax], eg [0,1], to [emin,emax], eg [0,0.5]
const map = (val, smin, smax, emin, emax) => (emax-emin)*(val-smin)/(smax-smin) + emin;

//rotates geometries about a specified axis and pivot
const rotateAbout = (geometry, meshPosition, axis, axisPosition, angle) => {
    geometry.applyMatrix(new THREE.Matrix4().makeTranslation(meshPosition.x-axisPosition.x, meshPosition.y-axisPosition.y, meshPosition.z-axisPosition.z));  //translate geometry to axis location
    geometry.applyMatrix(new THREE.Matrix4().makeRotationAxis(axis, angle));    //rotate geometry about axis
    geometry.applyMatrix(new THREE.Matrix4().makeTranslation(axisPosition.x-meshPosition.x, axisPosition.y-meshPosition.y, axisPosition.z-meshPosition.z));  //translate geometry back to original location
}

//game loop
const update = () => {
    stats.begin();
    if (!sonicHasCrashed) {delta = clock.getDelta();
    worlds.forEach((item, index) => {
        let prevIndex = index == 0 ? worlds.length - 1 : index - 1;
        if (item.position.z >= 12) item.position.z = worlds[prevIndex].position.z - 12;
        item.position.z += speed*delta;    //makes game speed consistent regardless of framerate
    });
    speed += 0.04*delta; //gradually increases speed
    obstacles.forEach(obstacle => {
        obstacle.position.z += speed*delta;
        obstacle.children.forEach(coin => {
            if (coin.geometry.type != "TorusBufferGeometry") return; //skip this iteration (element is not a coin)
            if (sonic){
                if (sonic.position.x > obstacle.position.x - laneWidth/2 && sonic.position.x < obstacle.position.x + laneWidth/2 && obstacle.position.z+coin.position.z >= sonic.position.z){
                    //coin consumed
                    if (coin.visible){
                        score++;
                        scoreLabel.innerHTML = `Coins: ${score}`;
                        if (score % 100 == 0 && score != 0){
                            levelUpSound.play();
                            level++;
                            levelLabel.innerHTML = `Level: ${level}`;
                            scoreLabel.style.color = '#ff0000';
                            let index = 1, colors = ['#ff0000', '#ffa500', '#ffff00', '#00ff00', '#0000ff', '#ee82ee'], interval = setInterval(() => {
                                scoreLabel.style.color = colors[index];
                                levelLabel.style.visibility = index % 2 ? "hidden" : "visible";
                                index++;
                            }, 500);
                            setTimeout(() => {
                                clearInterval(interval);
                                scoreLabel.style.color = '#ffffff';
                                levelLabel.style.visibility = "visible";
                            }, 2999);
                        }
                    };
                    coin.visible = false;
                }
            }
        })
    });
    if (sonic) readdToPath();
    monitorActions(delta);
    if (animationMixer) animationMixer.update(delta);
    if (strafingMixer) strafingMixer.update(delta);
    if (rotationMixer) rotationMixer.update(delta);}
    glow.material.uniforms.viewVector.value = new THREE.Vector3().subVectors(camera.position, glow.position);
    render();
    stats.end();
    animationFrame = requestAnimationFrame(update);
}

//render
const render = () => {
    renderer.render(scene, camera);
}

//event handler(s)
//resize
const onPageResize = () => {
    if (camera){
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    }
    if (renderer) renderer.setSize(window.innerWidth, window.innerHeight);
    if (scoreLabel) scoreLabel.style.left = `${window.innerWidth/2 - 40}px`;
}
//arrow keys(computer)
const onKeyDown = event => {
    switch (event.keyCode) {
        case 37:
            //left
            strafe(true);
            break;
        case 38:
            //up
            jump();
            break;
        case 39:
            //right
            strafe(false);
            break;
        case 40:
            //down
            roll();
            break;
    }
}
//swipe(mobile)
let xDown = null;
let yDown = null;
const getTouches = event => {
    return event.touches || event.originalEvent.touches;
}
const onTouchStart = event => {
    const firstTouch = getTouches(event)[0];
    xDown = firstTouch.clientX;
    yDown = firstTouch.clientY;
};
const onTouchMove = event => {
    if (!xDown || !yDown) {
        return;
    }
    let xUp = event.touches[0].clientX;
    let yUp = event.touches[0].clientY;
    let xDiff = xDown - xUp;
    let yDiff = yDown - yUp;
    if (Math.abs(xDiff) > Math.abs(yDiff)) {
        if (xDiff > 0) {
            //left
            strafe(true);
        } else {
            //right
            strafe(false);
        }
    } else {
        if (yDiff > 0) {
            //up
            jump();
        } else {
            //down
            roll();
        }
    }
    xDown = null;
    yDown = null;
};

//event listener(s)
window.addEventListener('resize', onPageResize, false);
document.addEventListener('keydown', onKeyDown, false);
document.addEventListener('touchstart', onTouchStart, false);
document.addEventListener('touchmove', onTouchMove, false);

//********************

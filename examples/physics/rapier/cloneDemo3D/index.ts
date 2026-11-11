import * as  RAPIER from "@dimforge/rapier3d";

import { initWe } from "./we";
import { Testbed } from "./Testbed";
import * as CollisionGroups from "./demos/collisionGroups";
import * as CharacterController from "./demos/characterController";
import * as ConvexPolyhedron from "./demos/convexPolyhedron";
import * as CCD from "./demos/ccd";
import * as Damping from "./demos/damping";
import * as Fountain from "./demos/fountain";
import * as Heightfield from "./demos/heightfield";
import * as Joints from "./demos/joints";
import * as Keva from "./demos/keva";
import * as LockedRotations from "./demos/lockedRotations";
import * as PidController from "./demos/pidController";
import * as Platform from "./demos/platform";
import * as Pyramid from "./demos/pyramid";
import * as Trimesh from "./demos/trimesh";
import * as Voxels from "./demos/voxels";
import * as glbToConvexHull from "./demos/glbtoConvexHull";
import * as glbToTrimesh from "./demos/glbToTrimesh";

declare global {
    interface Window {
        scene: any
        DC: any
    }
}
let scene = await initWe();

type RAPIER_API = typeof RAPIER;
// type RAPIER_API = typeof import("@dimforge/rapier3d");

let builders = new Map([
    // ["GLTF to convexHull", glbToConvexHull.initWorld],

    // ["convex polyhedron", ConvexPolyhedron.initWorld],

    ["collision groups", CollisionGroups.initWorld],
    ["character controller", CharacterController.initWorld],
    ["convex polyhedron", ConvexPolyhedron.initWorld],
    ["CCD", CCD.initWorld],
    ["damping", Damping.initWorld],
    ["fountain", Fountain.initWorld],
    ["heightfield", Heightfield.initWorld],
    ["joints", Joints.initWorld],
    ["keva tower", Keva.initWorld],
    ["locked rotations", LockedRotations.initWorld],
    ["pid controller", PidController.initWorld],
    ["platform", Platform.initWorld],
    ["pyramid", Pyramid.initWorld],
    ["triangle mesh", Trimesh.initWorld],
    ["voxels", Voxels.initWorld],
    ["GLTF to convexHull", glbToConvexHull.initWorld],
    ["GLTF to trimesh", glbToTrimesh.initWorld],
]);
let testbed = new Testbed(RAPIER as RAPIER_API, builders, scene);
testbed.run();

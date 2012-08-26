if (typeof define !== 'function') { var define = require('amdefine')(module);}
define(function(require, exports, module){

function fract(x) {
    return x-Math.floor(x);
}
    

var voxel = exports,
    vec3 = require('gl-matrix').vec3,
    extend = require('./utils').extend;

var SimplexNoise = require('simplex-noise');

voxel.World = function VoxelWorld(options) {
    extend(this, options);
    this.chunk_shift = Math.log(this.chunk_size)/Math.log(2);
    this.chunk_mask = this.chunk_size - 1;
    this.iscale = 1.0/this.scale;
    this.grid = [];
    this.chunks = [];
    this.init_chunks();
};
voxel.World.prototype = {
    chunk_size: 32,
    scale: 0.5,
    width: 32,
    depth: 32,
    height: 2,
    key: 1,
    materials: [
        {
            name: 'air',
            color: [0, 0, 0]
        },
        {
            name: 'grass',
            color: [0.28, 0.98, 0.17]
        },
        {
            name: 'dirt',
            color: [0.98, 0.57, 0.26]
        },
        {
            name: 'stone',
            color: [0.75, 0.7, 0.7]
        }


    ],
    init_chunks: function () {
        var rect, line;
        for(var x = 0; x < this.width; x++) {
            rect = [];
            for(var y = 0; y < this.height; y++) {
                line = [];
                for(var z = 0; z < this.depth; z++) {
                    var chunk = new voxel.Chunk(this.key++, x, y, z, this.chunk_size, this.scale);
                    line.push(chunk);
                    this.chunks.push(chunk);
                }
                rect.push(line);
            }
            this.grid.push(rect);
        }
    },
    voxel: function(position, value) {
        var scale = this.scale,
            iscale = this.iscale,
            cs = this.chunk_shift,
            cm = this.chunk_mask,
            fx = Math.floor(position[0]*iscale),
            fy = Math.floor(position[1]*iscale),
            fz = Math.floor(position[2]*iscale),
            size = this.chunk_size,
            limit_x = size*this.width,
            limit_y = size*this.height,
            limit_z = size*this.depth,
            // position of chunk in grid
            gx = fx>>cs, gy = fy>>cs, gz = fz>>cs,
            // position of voxel in chunk
            cx = fx&cm, cy = (fy&cm)*size, cz = (fz&cm)*size*size;
            if(fx < 0 || fx >= limit_x || fy < 0 || fy >= limit_y || fz < 0 || fz >= limit_z) {
                return -1;
            }
            var chunk = this.grid[gx][gy][gz];
            if(value !== undefined){
                chunk.voxels[cx+cy+cz] = value;
                chunk.version++;
                return value;
            }
            else {
                //console.log(cx, cy, cz, iscale, position, cs, cm, gx, gy, gz);
                return chunk.voxels[cx+cy+cz];
            }
    },
    ray_query: function(ray, maxT, location, last_location) {
        var iscale = this.iscale,
            scale = this.scale,
            x = ray[0]*iscale, y = ray[1]*iscale, z = ray[2]*iscale,
            // last positions
            dx = ray[3], dy = ray[4], dz = ray[5],
            // the direction of the steps on each axis
            step_x = dx >= 0 ? 1 : -1,
            step_y = dy >= 0 ? 1 : -1,
            step_z = dz >= 0 ? 1 : -1,
            // the value t at which the ray will enter the next
            // cell on the given axis
            max_x = dx === 0 ? maxT*2 : (dx >= 0 ? (1.0-fract(x))/dx : -fract(x)/dx),
            max_y = dy === 0 ? maxT*2 : (dy >= 0 ? (1.0-fract(y))/dy : -fract(y)/dy),
            max_z = dz === 0 ? maxT*2 : (dz >= 0 ? (1.0-fract(z))/dz : -fract(z)/dz),
            // the distance that needs to be traveled along the ray
            // for the movement on a axis to equal one grid cell
            delta_x = Math.abs(1.0/dx),
            delta_y = Math.abs(1.0/dy),
            delta_z = Math.abs(1.0/dz),
            // terminal field, floor dont ~~
            tx = Math.floor(x+dx*maxT),
            ty = Math.floor(y+dy*maxT),
            tz = Math.floor(z+dz*maxT),
            size = this.chunk_size,
            limit_x = size*this.width,
            limit_y = size*this.height,
            limit_z = size*this.depth,
            cs = this.chunk_shift,
            cm = this.chunk_mask,
            fx = Math.floor(x),
            fy = Math.floor(y),
            fz = Math.floor(z),
            lx = fx, ly = fy, lz = fz,
            // position of chunk in grid
            gx = fx>>cs, gy = fy>>cs, gz = fz>>cs,
            // position of voxel in chunk
            cx = fx&cm, cy = (fy&cm)*size, cz = (fz&cm)*size*size,
            hit = false;

        //console.log('=========== ray_query');
        //console.log('pos', x, y, z);
        //console.log('dir', dx, dy, dz);
        //console.log('t', tx, ty, tz);
        while(fx !== tx || fy !== ty || fz !== tz){
            lx = fx;
            ly = fy;
            lz = fz;
            if(max_x < max_y)
            {
                if(max_x < max_z){
                    x += step_x;
                    fx = Math.floor(x);
                    gx = fx>>cs;
                    cx = fx&cm;
                    max_x += delta_x;
                }
                else{
                    z += step_z;
                    fz = Math.floor(z);
                    gz = fz>>cs;
                    cz = (fz&cm)*size*size;
                    max_z += delta_z;
                }
            }
            else {
                if(max_y < max_z){
                    y += step_y;
                    fy = Math.floor(y);
                    gy = fy>>cs;
                    cy = (fy&cm)*size;
                    max_y += delta_y;
                }
                else{
                    z += step_z;
                    fz = Math.floor(z);
                    gz = fz>>cs;
                    cz = (fz&cm)*size*size;
                    max_z += delta_z;
                }
            }
            //console.log('pos', x, y, z);
            //console.log('f', fx, fy, fz);
            //console.log('g', gx, gy, gz);
            //console.log('c', cx, cy, cz);
            if(x < 0 || x >= limit_x || y < 0 || y >= limit_y || z < 0 || z >= limit_z){
                //console.log('limit');
                //TODO: solve this by clipping!
                continue;
            }
            var voxel = this.grid[gx][gy][gz].voxels[cx+cy+cz];
            if(voxel !== 0){
                hit = true;
                //console.log('hit ' + voxel);
                //console.log('hit');
                break;
            }
            //console.log('max', max_x, max_y, max_z);
            //console.log('miss');
        }
        if(hit){
            location[0] = fx*scale;
            location[1] = fy*scale;
            location[2] = fz*scale;
            last_location[0] = lx*scale;
            last_location[1] = ly*scale;
            last_location[2] = lz*scale;
        }
        return hit;
    }
};

voxel.Chunk = function (key, x, y, z, size, scale){
    this.position = vec3.create([x, y, z]);
    this.size = size || 32;
    this.scale = scale || 0.5;
    this.key = key;
    this.init_aabb(x, y, z);
    this.voxels = new Uint8Array(this.size*this.size*this.size);
};
voxel.Chunk.prototype = {
    scale: 0.5,
    nonempty_voxels: 0,
    size: 32,
    version: 0,
    init_aabb: function(x, y, z) {
        var left = x*this.size*this.scale,
            right = left+this.size*this.scale,
            bottom = y*this.size*this.scale,
            top = bottom+this.size*this.scale,
            back = z*this.size*this.scale,
            front = back+this.size*this.scale;
        this.aabb = new Float32Array([left, bottom, back, right, top, front]);
    }
};

voxel.init_world = function(world, f) {
    for(var i = 0; i < world.chunks.length; i++) {
        var chunk = world.chunks[i];
        for(var x = 0; x < chunk.size; x++) {
            for(var y = 0; y < chunk.size; y++) {
                for(var z = 0; z < chunk.size; z++) {
                    var j = x+y*chunk.size+z*chunk.size*chunk.size,
                        m = chunk.voxels[j],
                        n = f((chunk.position[0]*chunk.size+x),
                              (chunk.position[1]*chunk.size+y),
                              (chunk.position[2]*chunk.size+z));

                    chunk.voxels[j] = n;
                    chunk.nonempty_voxels += Math.min(n, 1) - Math.min(m, 1);
                }
            }
        }
        chunk.version++;
    }

};

voxel.flat_world = function(world, height){
    voxel.init_world(world, function(x, y, z) {
        return y > height ? 0 : (y == height ? 1 : 2);
    });
};

voxel.random_world = function(world) {
    var simplex = new SimplexNoise();
    voxel.init_world(world, function(x, y, z) {
        var density = simplex.noise3D(x/64, y/64, z/64)-y/64;
        return density > -1.0 ? (density > -0.92 ? 2 : 1) : 0;
    });
};
    

});

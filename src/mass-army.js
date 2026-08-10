import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const QUALITY = {
  performance: { aiHz: 14, animationHz: 15, renderDistance: 300, limbDistance: 70, detailBudget: 50 },
  balanced: { aiHz: 18, animationHz: 21, renderDistance: 520, limbDistance: 145, detailBudget: 110 },
  high: { aiHz: 21, animationHz: 26, renderDistance: 720, limbDistance: 210, detailBudget: 200 },
  ultra: { aiHz: 23, animationHz: 30, renderDistance: 960, limbDistance: 290, detailBudget: 320 },
};
const NPC_COUNTRY_CODES = 'TR US GB DE FR IT ES NL PL UA BR AR MX CA JP KR CN IN ID AU NZ ZA EG MA NG KE SE NO FI DK GR PT RO BG RS HR BA AZ GE KZ UZ PK BD TH VN PH MY SG SA AE QA IL JO CL CO PE VE'.split(' ');

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

export class MassArmySystem {
  constructor(scene, {
    countPerTeam = 247,
    terrainHeightAt,
    teamColors,
    quality = 'balanced',
    onShot = null,
    onAction = null,
    onPlayerHit = null,
    onKill = null,
    isBlocked = null,
    worldHalfWidth = 520,
    worldHalfDepth = 520,
  }) {
    this.scene = scene;
    this.countPerTeam = countPerTeam;
    this.count = countPerTeam * 2;
    this.terrainHeightAt = terrainHeightAt;
    this.teamColors = teamColors;
    this.teamColorObjects = {
      red: new THREE.Color(teamColors.red),
      blue: new THREE.Color(teamColors.blue),
    };
    this.onShot = onShot;
    this.onAction = onAction;
    this.onPlayerHit = onPlayerHit;
    this.onKill = onKill;
    this.isBlocked = isBlocked;
    this.worldHalfWidth = worldHalfWidth;
    this.worldHalfDepth = worldHalfDepth;
    this.profile = QUALITY[quality] || QUALITY.balanced;
    this.quality = quality;
    this.aiAccumulator = 0;
    this.animationAccumulator = 0;
    this.simulationTime = 0;
    this.terrainCursor = 0;
    this.shotBudget = 10;
    this.playerHitBudget = 1;
    this.shots = 0;
    this.deaths = [0, 0];

    this.team = new Uint8Array(this.count);
    this.dead = new Uint8Array(this.count);
    this.action = new Uint8Array(this.count);
    this.x = new Float32Array(this.count);
    this.y = new Float32Array(this.count);
    this.targetY = new Float32Array(this.count);
    this.z = new Float32Array(this.count);
    this.yaw = new Float32Array(this.count);
    this.phase = new Float32Array(this.count);
    this.speed = new Float32Array(this.count);
    this.health = new Float32Array(this.count);
    this.weapon = new Uint8Array(this.count);
    this.shieldActive = new Uint8Array(this.count);
    this.kills = new Uint16Array(this.count);
    this.playerDeaths = new Uint16Array(this.count);
    this.score = new Uint32Array(this.count);
    this.elapsedSeconds = new Float32Array(this.count);
    this.deadTimer = new Float32Array(this.count);
    this.actionTime = new Float32Array(this.count);
    this.audioStepBucket = new Int32Array(this.count);
    this.detailLodState = new Uint8Array(this.count);
    this.spawnX = new Float32Array(this.count);
    this.names = new Array(this.count);
    this.countryCodes = new Array(this.count);
    this.playerTarget = null;
    this.focus = null;
    this.listenerX = Infinity;
    this.listenerY = Infinity;
    this.listenerZ = Infinity;

    this.dummy = new THREE.Object3D();
    this.hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    this.meshes = this.createMeshes();
    this.farPoints = this.createFarPoints();
    this.initializeAgents();
    this.updateInstanceMatrices(new THREE.Vector3(0, 0, 0), false);
  }

  createInstancedMesh(geometry, material) {
    const mesh = new THREE.InstancedMesh(geometry, material, this.count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    this.scene.add(mesh);
    return mesh;
  }

  createMeshes() {
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const skinMaterial = new THREE.MeshLambertMaterial({ color: 0xd7aa7c });
    const equipmentMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
    const shieldMaterial = new THREE.MeshLambertMaterial({ color: 0x56646a });
    const teamEquipmentMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const eyeMaterial = new THREE.MeshLambertMaterial({ color: 0xf4f1e8 });
    const faceMaterial = new THREE.MeshLambertMaterial({ color: 0x171411 });
    const colorize = (source, color) => {
      const geometry = source.index ? source.toNonIndexed() : source;
      if (geometry !== source) source.dispose();
      const value = new THREE.Color(color);
      const colors = new Float32Array(geometry.attributes.position.count * 3);
      for (let offset = 0; offset < colors.length; offset += 3) {
        colors[offset] = value.r;
        colors[offset + 1] = value.g;
        colors[offset + 2] = value.b;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return geometry;
    };
    const mergeColoredParts = (parts) => {
      const geometry = mergeGeometries(parts, false);
      parts.forEach((part) => part.dispose());
      return geometry;
    };

    const rifleStock = new THREE.BoxGeometry(0.17, 0.2, 0.72).translate(0, 0, -0.22);
    const rifleReceiver = new THREE.BoxGeometry(0.13, 0.14, 0.52).translate(0, 0, 0.38);
    const rifleBarrel = new THREE.CylinderGeometry(0.025, 0.035, 1.28, 8).rotateX(Math.PI / 2).translate(0, 0, 1.18);
    const rifleScope = new THREE.CylinderGeometry(0.065, 0.065, 0.52, 10).rotateX(Math.PI / 2).translate(0, 0.13, 0.38);
    const rifleMuzzle = new THREE.TorusGeometry(0.04, 0.012, 6, 10).translate(0, 0, 1.84);
    const rifleBolt = new THREE.CylinderGeometry(0.018, 0.018, 0.2, 7).rotateZ(Math.PI / 2).translate(0.12, 0.02, 0.38);
    const rifleGeometry = mergeColoredParts([
      colorize(rifleStock, 0x5b3824),
      colorize(rifleReceiver, 0x242927),
      colorize(rifleBarrel, 0x242927),
      colorize(rifleScope, 0x242927),
      colorize(rifleMuzzle, 0x242927),
      colorize(rifleBolt, 0x242927),
    ]);

    const swordBlade = new THREE.BoxGeometry(0.11, 1.32, 0.038).translate(0, 0.72, 0);
    const swordTip = new THREE.ConeGeometry(0.082, 0.28, 4).rotateY(Math.PI / 4).translate(0, 1.52, 0);
    const swordFuller = new THREE.BoxGeometry(0.026, 1.03, 0.02).translate(0, 0.69, -0.031);
    const swordGuard = new THREE.CylinderGeometry(0.045, 0.065, 0.58, 10).rotateZ(Math.PI / 2);
    const swordGrip = new THREE.CylinderGeometry(0.052, 0.062, 0.42, 10).translate(0, -0.24, 0);
    const swordPommel = new THREE.SphereGeometry(0.09, 10, 8).translate(0, -0.49, 0);
    const swordGeometry = mergeColoredParts([
      colorize(swordBlade, 0xe9eef0),
      colorize(swordTip, 0xe9eef0),
      colorize(swordFuller, 0x778187),
      colorize(swordGuard, 0xa7792d),
      colorize(swordGrip, 0x5b3824),
      colorize(swordPommel, 0xa7792d),
    ]);

    const shieldFace = new THREE.CylinderGeometry(0.61, 0.7, 0.13, 18).rotateX(Math.PI / 2);
    const shieldRim = new THREE.TorusGeometry(0.675, 0.045, 7, 22).translate(0, 0, 0.075);
    const shieldBoss = new THREE.SphereGeometry(0.18, 10, 7);
    shieldBoss.scale(1, 1, 0.42).translate(0, 0, 0.105);
    const shieldGeometry = mergeGeometries([
      shieldFace.index ? shieldFace.toNonIndexed() : shieldFace,
      shieldRim.index ? shieldRim.toNonIndexed() : shieldRim,
      shieldBoss.index ? shieldBoss.toNonIndexed() : shieldBoss,
    ], false);
    shieldFace.dispose();
    shieldRim.dispose();
    shieldBoss.dispose();
    const eyeSource = new THREE.SphereGeometry(0.052, 7, 5);
    const eyeGeometry = mergeGeometries([
      eyeSource.clone().translate(-0.075, 0, 0),
      eyeSource.clone().translate(0.075, 0, 0),
    ], false);
    const pupilSource = new THREE.SphereGeometry(0.026, 7, 5);
    const pupilGeometry = mergeGeometries([
      pupilSource.clone().translate(-0.075, 0, 0),
      pupilSource.clone().translate(0.075, 0, 0),
    ], false);
    eyeSource.dispose();
    pupilSource.dispose();
    const meshes = {
      torso: this.createInstancedMesh(new THREE.CapsuleGeometry(0.25, 0.5, 3, 6), bodyMaterial),
      head: this.createInstancedMesh(new THREE.SphereGeometry(0.215, 8, 6), skinMaterial),
      leftLeg: this.createInstancedMesh(new THREE.CapsuleGeometry(0.1, 0.46, 3, 5), bodyMaterial),
      rightLeg: this.createInstancedMesh(new THREE.CapsuleGeometry(0.1, 0.46, 3, 5), bodyMaterial),
      leftArm: this.createInstancedMesh(new THREE.CapsuleGeometry(0.078, 0.47, 3, 5), bodyMaterial),
      rightArm: this.createInstancedMesh(new THREE.CapsuleGeometry(0.078, 0.47, 3, 5), bodyMaterial),
      rifle: this.createInstancedMesh(rifleGeometry, equipmentMaterial),
      sword: this.createInstancedMesh(swordGeometry, equipmentMaterial),
      shield: this.createInstancedMesh(shieldGeometry, shieldMaterial),
      shieldStripe: this.createInstancedMesh(new THREE.BoxGeometry(0.17, 1.02, 0.035), teamEquipmentMaterial),
      penis: this.createInstancedMesh(new THREE.CapsuleGeometry(0.048, 0.14, 2, 5), skinMaterial),
      leftButtock: this.createInstancedMesh(new THREE.SphereGeometry(0.15, 7, 5), skinMaterial),
      rightButtock: this.createInstancedMesh(new THREE.SphereGeometry(0.15, 7, 5), skinMaterial),
      faceEyes: this.createInstancedMesh(eyeGeometry, eyeMaterial),
      facePupils: this.createInstancedMesh(pupilGeometry, faceMaterial),
      faceMouth: this.createInstancedMesh(new THREE.BoxGeometry(0.145, 0.03, 0.03), faceMaterial),
    };
    for (let index = 0; index < this.count; index += 1) {
      const color = index < this.countPerTeam ? this.teamColorObjects.red : this.teamColorObjects.blue;
      for (const key of ['torso', 'leftLeg', 'rightLeg', 'leftArm', 'rightArm']) meshes[key].setColorAt(index, color);
      meshes.shieldStripe.setColorAt(index, color);
    }
    for (const key of ['torso', 'leftLeg', 'rightLeg', 'leftArm', 'rightArm', 'shieldStripe']) {
      meshes[key].instanceColor.setUsage(THREE.DynamicDrawUsage);
      meshes[key].instanceColor.needsUpdate = true;
    }
    return meshes;
  }

  createFarPoints() {
    // Uzak oyuncular artık pembe/mavi nokta sprite değildir. Aynı tek matrisi kullanan
    // iki düşük-poligon instanced mesh, insan siluetini ve ten rengi başı korur.
    const bodyParts = [
      new THREE.BoxGeometry(0.42, 0.7, 0.24).translate(0, 1.05, 0),
      new THREE.BoxGeometry(0.11, 0.58, 0.11).translate(-0.29, 1.04, 0),
      new THREE.BoxGeometry(0.11, 0.58, 0.11).translate(0.29, 1.04, 0),
      new THREE.BoxGeometry(0.15, 0.62, 0.17).translate(-0.12, 0.32, 0),
      new THREE.BoxGeometry(0.15, 0.62, 0.17).translate(0.12, 0.32, 0),
      new THREE.BoxGeometry(0.09, 0.09, 0.72).translate(0.18, 1.15, 0.3),
    ];
    const bodyGeometry = mergeGeometries(bodyParts, false);
    bodyParts.forEach((part) => part.dispose());
    const body = new THREE.InstancedMesh(bodyGeometry, new THREE.MeshLambertMaterial({ color: 0xffffff }), this.count);
    const headGeometry = new THREE.OctahedronGeometry(0.21, 0).translate(0, 1.66, 0);
    const head = new THREE.InstancedMesh(headGeometry, new THREE.MeshLambertMaterial({ color: 0xd7aa7c }), this.count);
    for (const mesh of [body, head]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.count = 0;
      this.scene.add(mesh);
    }
    body.setColorAt(0, this.teamColorObjects.red);
    body.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.simplifiedMeshes = { body, head };
    return body;
  }

  initializeAgents() {
    const random = seededRandom(0xB1B1500);
    for (let pair = 0; pair < this.countPerTeam; pair += 1) {
      const normalizedLane = ((pair * 73) % this.countPerTeam) / Math.max(1, this.countPerTeam - 1);
      const laneSpan = (this.worldHalfWidth - 70) * 2;
      const lane = -laneSpan / 2 + normalizedLane * laneSpan + (random() - 0.5) * 7;
      for (let team = 0; team < 2; team += 1) {
        const index = team === 0 ? pair : pair + this.countPerTeam;
        const depth = 45 + random() * (this.worldHalfDepth - 210);
        this.team[index] = team;
        this.x[index] = lane + (random() - 0.5) * 5;
        this.z[index] = team === 0 ? -depth : depth;
        this.spawnX[index] = lane;
        this.y[index] = this.terrainHeightAt(this.x[index], this.z[index]);
        this.ensureOpenPosition(index);
        this.targetY[index] = this.y[index];
        this.yaw[index] = team === 0 ? 0 : Math.PI;
        this.phase[index] = random() * Math.PI * 2;
        this.audioStepBucket[index] = Math.floor(this.phase[index] / Math.PI);
        this.speed[index] = 4.4 + random() * 2.2;
        this.health[index] = 100;
        this.weapon[index] = 0;
        this.shieldActive[index] = 0;
        this.kills[index] = Math.floor(random() * 16);
        this.playerDeaths[index] = Math.floor(random() * 8);
        this.score[index] = 260 + this.kills[index] * 54 + Math.floor(random() * 260);
        this.elapsedSeconds[index] = 600 + Math.floor(random() * 10800);
        this.names[index] = `${team === 0 ? 'Kızıl' : 'Mavi'}-${String(pair + 4).padStart(4, '0')}`;
        this.countryCodes[index] = NPC_COUNTRY_CODES[(pair * 17 + team * 11) % NPC_COUNTRY_CODES.length];
      }
    }
  }

  setQuality(quality) {
    this.quality = quality;
    this.profile = QUALITY[quality] || QUALITY.balanced;
  }

  ensureOpenPosition(index) {
    for (let attempt = 0; attempt < 18; attempt += 1) {
      this.y[index] = this.terrainHeightAt(this.x[index], this.z[index]);
      if (!this.isBlocked?.(this.x[index], this.z[index], this.y[index])) return;
      const angle = index * 2.399 + attempt * 1.17;
      const radius = 3 + attempt * 1.35;
      this.x[index] = THREE.MathUtils.clamp(this.spawnX[index] + Math.cos(angle) * radius, -this.worldHalfWidth + 48, this.worldHalfWidth - 48);
      this.z[index] = THREE.MathUtils.clamp(this.z[index] + Math.sin(angle) * radius, -this.worldHalfDepth + 48, this.worldHalfDepth - 48);
    }
  }

  respawn(index) {
    const team = this.team[index];
    const jitter = Math.sin(index * 91.17 + this.simulationTime) * 18;
    this.dead[index] = 0;
    this.health[index] = 100;
    this.x[index] = THREE.MathUtils.clamp(this.spawnX[index] + jitter, -this.worldHalfWidth + 56, this.worldHalfWidth - 56);
    const homeDepth = this.worldHalfDepth - 90;
    this.z[index] = team === 0 ? -homeDepth + Math.abs(jitter) * 0.5 : homeDepth - Math.abs(jitter) * 0.5;
    this.y[index] = this.terrainHeightAt(this.x[index], this.z[index]);
    this.ensureOpenPosition(index);
    this.targetY[index] = this.y[index];
    this.action[index] = 0;
    this.actionTime[index] = 0;
    this.weapon[index] = 0;
    this.shieldActive[index] = 0;
  }

  simulate(step) {
    this.simulationTime += step;
    this.shotBudget = Math.min(16, this.shotBudget + step * 9);
    this.playerHitBudget = Math.min(2, this.playerHitBudget + step * 0.85);
    const terrainModulo = 5;
    for (let index = 0; index < this.count; index += 1) {
      if (this.dead[index]) {
        this.deadTimer[index] -= step;
        if (this.deadTimer[index] <= 0) this.respawn(index);
        continue;
      }
      this.elapsedSeconds[index] += step;

      const enemyIndex = this.team[index] === 0 ? index + this.countPerTeam : index - this.countPerTeam;
      const agentTeam = this.team[index] === 0 ? 'red' : 'blue';
      const canTargetPlayer = Boolean(this.playerTarget?.active && this.playerTarget.team !== agentTeam);
      const playerDeltaX = canTargetPlayer ? this.playerTarget.x - this.x[index] : 0;
      const playerDeltaZ = canTargetPlayer ? this.playerTarget.z - this.z[index] : 0;
      const playerDistance = canTargetPlayer ? Math.hypot(playerDeltaX, playerDeltaZ) : Infinity;
      const targetingPlayer = playerDistance <= 108;
      if (this.dead[enemyIndex] && !targetingPlayer) {
        this.action[index] = 0;
        this.weapon[index] = 0;
        this.shieldActive[index] = 0;
        this.phase[index] += step * 8;
        continue;
      }

      const deltaX = targetingPlayer ? playerDeltaX : this.x[enemyIndex] - this.x[index];
      const deltaZ = targetingPlayer ? playerDeltaZ : this.z[enemyIndex] - this.z[index];
      const distance = Math.max(0.001, Math.hypot(deltaX, deltaZ));
      const directionX = deltaX / distance;
      const directionZ = deltaZ / distance;
      this.yaw[index] = Math.atan2(directionX, directionZ);
      this.actionTime[index] = Math.max(0, this.actionTime[index] - step);
      const usingSword = distance <= 3.55;
      const shieldWasActive = this.shieldActive[index] === 1;
      this.weapon[index] = usingSword ? 1 : 0;
      this.shieldActive[index] = usingSword && Math.sin(this.simulationTime * 2.15 + index * 0.73) > -0.28 ? 1 : 0;
      const listenerDeltaX = this.x[index] - this.listenerX;
      const listenerDeltaY = this.y[index] + 1 - this.listenerY;
      const listenerDeltaZ = this.z[index] - this.listenerZ;
      const insideActionAudioRange = listenerDeltaX * listenerDeltaX + listenerDeltaY * listenerDeltaY + listenerDeltaZ * listenerDeltaZ <= 105 * 105;
      if (!shieldWasActive && this.shieldActive[index] && insideActionAudioRange) {
        this.onAction?.({
          type: 'shieldRaise',
          position: new THREE.Vector3(this.x[index], this.y[index] + 1.05, this.z[index]),
          team: agentTeam,
          index,
        });
      } else if (shieldWasActive && !this.shieldActive[index] && insideActionAudioRange) {
        this.onAction?.({
          type: 'shieldLower',
          position: new THREE.Vector3(this.x[index], this.y[index] + 1.05, this.z[index]),
          team: agentTeam,
          index,
        });
      }

      const engagementDistance = targetingPlayer ? 42 : 27;
      if (distance > engagementDistance) {
        const speed = this.speed[index] * (distance > 120 ? 1 : 0.72);
        const weave = Math.sin(this.phase[index] * 0.31 + index) * 0.42;
        const movementX = (directionX + directionZ * weave * 0.16) * speed * step;
        const movementZ = (directionZ - directionX * weave * 0.16) * speed * step;
        if (!this.isBlocked?.(this.x[index] + movementX, this.z[index], this.y[index])) this.x[index] += movementX;
        else this.phase[index] += 0.72;
        if (!this.isBlocked?.(this.x[index], this.z[index] + movementZ, this.y[index])) this.z[index] += movementZ;
        else this.phase[index] += 0.72;
        this.action[index] = 0;
        this.weapon[index] = 0;
        this.shieldActive[index] = 0;
      } else {
        this.action[index] = usingSword ? 4 : 1;
        const strafe = Math.sin(this.simulationTime * 1.7 + index * 0.41) * step * 1.35;
        const strafeX = directionZ * strafe;
        const strafeZ = -directionX * strafe;
        if (!this.isBlocked?.(this.x[index] + strafeX, this.z[index], this.y[index])) this.x[index] += strafeX;
        if (!this.isBlocked?.(this.x[index], this.z[index] + strafeZ, this.y[index])) this.z[index] += strafeZ;
        if (!targetingPlayer) {
          this.health[enemyIndex] -= step * (4.8 + (index % 7) * 0.18);
          if (this.health[enemyIndex] <= 0 && !this.dead[enemyIndex]) {
            this.dead[enemyIndex] = 1;
            this.deadTimer[enemyIndex] = 3;
            this.action[enemyIndex] = 3;
            this.deaths[this.team[enemyIndex]] += 1;
            this.playerDeaths[enemyIndex] += 1;
            this.score[enemyIndex] = Math.max(0, this.score[enemyIndex] - 25);
            this.kills[index] += 1;
            this.score[index] += 100;
            this.onKill?.({
              killer: this.getAgentInfo(index),
              victim: this.getAgentInfo(enemyIndex),
              weapon: usingSword ? 'sword' : 'rifle',
            });
          }
        }
        if (this.actionTime[index] <= 0) {
          this.actionTime[index] = usingSword ? 0.46 : 0.2;
          if (usingSword && insideActionAudioRange) {
            this.onAction?.({
              type: 'sword',
              position: new THREE.Vector3(this.x[index], this.y[index] + 1.1, this.z[index]),
              team: agentTeam,
              index,
            });
          }
          const shotGate = (index * 19 + Math.floor(this.simulationTime * 10)) % (targetingPlayer ? 13 : 23) === 0;
          if (!usingSword && this.shotBudget >= 1 && shotGate) {
            this.shotBudget -= 1;
            this.shots += 1;
            this.onShot?.({
              team: agentTeam,
              start: new THREE.Vector3(this.x[index], this.y[index] + 1.25, this.z[index]),
              end: targetingPlayer
                ? new THREE.Vector3(this.playerTarget.x, this.playerTarget.y + 1.05, this.playerTarget.z)
                : new THREE.Vector3(this.x[enemyIndex], this.y[enemyIndex] + 1.05, this.z[enemyIndex]),
            });
          }
          if (targetingPlayer && this.playerHitBudget >= 1 && (usingSword || shotGate)) {
            this.playerHitBudget -= 1;
            const distanceFactor = THREE.MathUtils.clamp(1 - distance / 150, 0.38, 1);
            const zoneRoll = (index * 31 + Math.floor(this.simulationTime * 7)) % 10;
            const zone = zoneRoll === 0 ? 'head' : zoneRoll < 7 ? 'torso' : 'limb';
            const zoneFactor = zone === 'head' ? 1.55 : zone === 'limb' ? 0.64 : 1;
            this.onPlayerHit?.({
              source: new THREE.Vector3(this.x[index], this.y[index] + 1.25, this.z[index]),
              distance,
              zone,
              damage: usingSword ? 34 : Math.max(4, Math.round(15 * distanceFactor * zoneFactor)),
              attackerIndex: index,
            });
          }
        }
      }

      this.x[index] = THREE.MathUtils.clamp(this.x[index], -this.worldHalfWidth + 44, this.worldHalfWidth - 44);
      this.z[index] = THREE.MathUtils.clamp(this.z[index], -this.worldHalfDepth + 44, this.worldHalfDepth - 44);
      this.phase[index] += step * (this.action[index] === 0 ? 9.5 : 3.2);
      const currentStepBucket = Math.floor(this.phase[index] / Math.PI);
      if (this.action[index] === 0 && currentStepBucket !== this.audioStepBucket[index]) {
        const listenerDistanceSquared = listenerDeltaX * listenerDeltaX + listenerDeltaY * listenerDeltaY + listenerDeltaZ * listenerDeltaZ;
        const stanceCycle = Math.sin(index * 3.17 + this.simulationTime * 0.31);
        const prone = stanceCycle > 0.955;
        if (!prone && listenerDistanceSquared <= 68 * 68) {
          const mode = stanceCycle < -0.78 ? 'crouch' : this.speed[index] > 5.65 ? 'sprint' : 'walk';
          this.onAction?.({
            type: 'footstep',
            mode,
            position: new THREE.Vector3(this.x[index], this.y[index] + 0.08, this.z[index]),
            team: agentTeam,
            index,
          });
        }
      }
      this.audioStepBucket[index] = currentStepBucket;
      if ((index + this.terrainCursor) % terrainModulo === 0) {
        this.targetY[index] = this.terrainHeightAt(this.x[index], this.z[index]);
      }
      this.y[index] = THREE.MathUtils.lerp(this.y[index], this.targetY[index], Math.min(1, step * 7));
    }
    this.terrainCursor = (this.terrainCursor + 1) % terrainModulo;
  }

  setPart(mesh, index, baseX, baseY, baseZ, yaw, localX, localY, localZ, rotationX = 0, rotationZ = 0, scaleX = 1, scaleY = 1, scaleZ = 1, localYaw = 0) {
    const sine = Math.sin(yaw);
    const cosine = Math.cos(yaw);
    this.dummy.position.set(
      baseX + localX * cosine + localZ * sine,
      baseY + localY,
      baseZ - localX * sine + localZ * cosine,
    );
    this.dummy.rotation.set(rotationX, yaw + localYaw, rotationZ, 'YXZ');
    this.dummy.scale.set(scaleX, scaleY, scaleZ);
    this.dummy.updateMatrix();
    mesh.setMatrixAt(this.activeRenderSlot ?? index, this.dummy.matrix);
  }

  hidePart(mesh, index) {
    mesh.setMatrixAt(this.activeRenderSlot ?? index, this.hiddenMatrix);
  }

  updateInstanceMatrices(cameraPosition, force = false, focus = this.focus) {
    const lodScale = THREE.MathUtils.clamp(focus?.lodScale || 1, 0.28, 1);
    // Basitleştirilmiş 3B insan yalnız iki çağrı kullanır; agresif performans korumasında
    // bile sis sınırına kadar kalır. Böylece uzak askerler bir anda yok olmaz.
    const simplifiedDistanceScale = Math.max(0.65, lodScale);
    const renderDistanceSquared = (this.profile.renderDistance * simplifiedDistanceScale) ** 2;
    const limbDistanceSquared = (this.profile.limbDistance * Math.max(0.72, lodScale)) ** 2;
    let detailedCount = 0;
    let simplifiedCount = 0;
    const requestedDetailBudget = Math.max(this.profile.detailBudget, Math.round(focus?.detailBudget || 0));
    const detailBudget = force ? this.count : Math.max(18, Math.round(requestedDetailBudget * Math.max(0.35, lodScale)));
    const closeVisibilitySquared = 24 * 24;
    // 997 is coprime with 1,990 and interleaves both armies, avoiding team-biased LOD slots.
    for (let scanIndex = 0; scanIndex < this.count; scanIndex += 1) {
      const index = (scanIndex * 997) % this.count;
      const dx = this.x[index] - cameraPosition.x;
      const dy = this.y[index] + 1.1 - cameraPosition.y;
      const dz = this.z[index] - cameraPosition.z;
      const distanceSquared = dx * dx + dz * dz;
      const focusDistanceSquared = dx * dx + dy * dy + dz * dz;
      const focusDistance = Math.sqrt(focusDistanceSquared);
      const viewDot = focus?.direction && focusDistance > 0.001
        ? (dx * focus.direction.x + dy * focus.direction.y + dz * focus.direction.z) / focusDistance
        : 1;
      const insideView = !focus?.viewActive || viewDot >= focus.viewCosine;
      const focusDetailed = Boolean(
        focus?.active && focusDistance > 0.001 && focusDistance <= focus.maxDistance &&
        viewDot >= focus.cosine
      );
      if (!force && ((!insideView && distanceSquared > closeVisibilitySquared) || (!focusDetailed && distanceSquared > renderDistanceSquared))) {
        continue;
      }

      const closeDetailed = distanceSquared <= 42 * 42;
      const hysteresisDistanceSquared = this.detailLodState[index] ? limbDistanceSquared * 1.24 : limbDistanceSquared;
      const wantsDetail = force || focusDetailed || (distanceSquared <= hysteresisDistanceSquared && (closeDetailed || insideView));
      const detailed = wantsDetail && (force || detailedCount < detailBudget);
      this.detailLodState[index] = detailed ? 1 : 0;
      if (!detailed) {
        if (!this.dead[index]) {
          const simplifiedBob = Math.abs(Math.sin(this.phase[index])) * 0.025;
          this.dummy.position.set(this.x[index], this.y[index] + simplifiedBob, this.z[index]);
          this.dummy.rotation.set(0, this.yaw[index], 0, 'YXZ');
          this.dummy.scale.set(1, 1, 1);
          this.dummy.updateMatrix();
          this.simplifiedMeshes.body.setMatrixAt(simplifiedCount, this.dummy.matrix);
          this.simplifiedMeshes.head.setMatrixAt(simplifiedCount, this.dummy.matrix);
          this.simplifiedMeshes.body.setColorAt(simplifiedCount, this.team[index] === 0 ? this.teamColorObjects.red : this.teamColorObjects.blue);
          simplifiedCount += 1;
        }
        continue;
      }
      this.activeRenderSlot = detailedCount;
      const uniformColor = this.team[index] === 0 ? this.teamColorObjects.red : this.teamColorObjects.blue;
      for (const key of ['torso', 'leftLeg', 'rightLeg', 'leftArm', 'rightArm']) this.meshes[key].setColorAt(detailedCount, uniformColor);
      this.meshes.shieldStripe.setColorAt(detailedCount, uniformColor);
      detailedCount += 1;

      const phase = this.phase[index];
      const stride = Math.sin(phase);
      const shooting = this.action[index] === 1;
      const swording = this.action[index] === 4;
      const dead = this.dead[index] === 1;
      const stanceCycle = Math.sin(index * 3.17 + this.simulationTime * 0.31);
      const prone = !dead && (!shooting && stanceCycle > 0.955);
      const crouch = !prone && (shooting || stanceCycle < -0.78);
      const recoil = shooting ? Math.sin(Math.min(1, this.actionTime[index] / 0.18) * Math.PI) : 0;
      const swordSwing = swording ? Math.sin(Math.min(1, Math.max(0, 1 - this.actionTime[index] / 0.46)) * Math.PI) : 0;
      const yaw = this.yaw[index];
      const baseY = this.y[index];

      if (dead) {
        // Ölüm pozu sürünmeden belirgin biçimde farklıdır: beden yana düşer, uzuvlar dağılır.
        this.setPart(this.meshes.torso, index, this.x[index], baseY, this.z[index], yaw, 0, 0.31, 0, 0, Math.PI / 2);
        this.setPart(this.meshes.head, index, this.x[index], baseY, this.z[index], yaw, 0.55, 0.25, 0.04, 0, 0.28);
        this.setPart(this.meshes.faceEyes, index, this.x[index], baseY, this.z[index], yaw, 0.55, 0.295, 0.238, 0, 0.28);
        this.setPart(this.meshes.facePupils, index, this.x[index], baseY, this.z[index], yaw, 0.55, 0.295, 0.278, 0, 0.28);
        this.setPart(this.meshes.faceMouth, index, this.x[index], baseY, this.z[index], yaw, 0.55, 0.165, 0.264, 0, 0.28);
        this.setPart(this.meshes.leftLeg, index, this.x[index], baseY, this.z[index], yaw, -0.42, 0.22, -0.2, 0, Math.PI / 2 + 0.18);
        this.setPart(this.meshes.rightLeg, index, this.x[index], baseY, this.z[index], yaw, -0.32, 0.22, 0.24, 0, Math.PI / 2 - 0.32);
        this.setPart(this.meshes.leftArm, index, this.x[index], baseY, this.z[index], yaw, 0.18, 0.2, -0.48, 0, Math.PI / 2 - 0.42);
        this.setPart(this.meshes.rightArm, index, this.x[index], baseY, this.z[index], yaw, 0.22, 0.2, 0.48, 0, Math.PI / 2 + 0.36);
        this.setPart(this.meshes.rifle, index, this.x[index], baseY, this.z[index], yaw, -0.25, 0.16, 0.62, Math.PI / 2, 0.35, 0.62, 0.62, 0.62);
        this.setPart(this.meshes.penis, index, this.x[index], baseY, this.z[index], yaw, 0, 0.25, 0.22, Math.PI / 2, Math.PI / 2);
        this.setPart(this.meshes.leftButtock, index, this.x[index], baseY, this.z[index], yaw, -0.13, 0.26, -0.17, 0, Math.PI / 2, 0.9, 1.05, 0.72);
        this.setPart(this.meshes.rightButtock, index, this.x[index], baseY, this.z[index], yaw, 0.13, 0.26, -0.17, 0, Math.PI / 2, 0.9, 1.05, 0.72);
      } else if (prone) {
        this.setPart(this.meshes.torso, index, this.x[index], baseY, this.z[index], yaw, 0, 0.38, 0.1, Math.PI / 2);
        this.setPart(this.meshes.head, index, this.x[index], baseY, this.z[index], yaw, 0, 0.43, 0.72, 0);
        this.setPart(this.meshes.faceEyes, index, this.x[index], baseY, this.z[index], yaw, 0, 0.475, 0.918, 0);
        this.setPart(this.meshes.facePupils, index, this.x[index], baseY, this.z[index], yaw, 0, 0.475, 0.958, 0);
        this.setPart(this.meshes.faceMouth, index, this.x[index], baseY, this.z[index], yaw, 0, 0.345, 0.944, 0);
        this.setPart(this.meshes.penis, index, this.x[index], baseY, this.z[index], yaw, 0, 0.34, 0.08, Math.PI / 2);
        this.setPart(this.meshes.leftButtock, index, this.x[index], baseY, this.z[index], yaw, -0.13, 0.33, -0.22, Math.PI / 2, 0, 0.9, 1.05, 0.72);
        this.setPart(this.meshes.rightButtock, index, this.x[index], baseY, this.z[index], yaw, 0.13, 0.33, -0.22, Math.PI / 2, 0, 0.9, 1.05, 0.72);
        if (detailed) {
          this.setPart(this.meshes.leftLeg, index, this.x[index], baseY, this.z[index], yaw, -0.15, 0.3, -0.46, Math.PI / 2 + stride * 0.1);
          this.setPart(this.meshes.rightLeg, index, this.x[index], baseY, this.z[index], yaw, 0.15, 0.3, -0.46, Math.PI / 2 - stride * 0.1);
          this.setPart(this.meshes.leftArm, index, this.x[index], baseY, this.z[index], yaw, -0.3, 0.36, 0.48, Math.PI / 2);
          this.setPart(this.meshes.rightArm, index, this.x[index], baseY, this.z[index], yaw, 0.3, 0.36, 0.48, Math.PI / 2);
          this.setPart(this.meshes.rifle, index, this.x[index], baseY, this.z[index], yaw, 0.1, 0.39, 0.74, Math.PI / 2, 0, 0.62, 0.62, 0.62);
        } else {
          for (const mesh of [this.meshes.leftLeg, this.meshes.rightLeg, this.meshes.leftArm, this.meshes.rightArm, this.meshes.rifle]) this.hidePart(mesh, index);
        }
      } else {
        const torsoY = crouch ? 0.8 : 1.08;
        const headY = crouch ? 1.39 : 1.78;
        const legY = crouch ? 0.29 : 0.38;
        const strideAmount = crouch ? 0.24 : 0.5;
        const breathing = Math.sin(phase * 0.21 + index) * 0.012;
        this.setPart(this.meshes.torso, index, this.x[index], baseY, this.z[index], yaw, 0, torsoY + breathing, crouch ? 0.08 : 0, crouch ? 0.12 : 0, stride * 0.025);
        this.setPart(this.meshes.head, index, this.x[index], baseY, this.z[index], yaw, 0, headY + breathing, crouch ? 0.1 : 0, shooting ? -0.06 : stride * 0.018);
        const faceZ = (crouch ? 0.1 : 0) + 0.198;
        const faceTilt = shooting ? -0.06 : stride * 0.018;
        this.setPart(this.meshes.faceEyes, index, this.x[index], baseY, this.z[index], yaw, 0, headY + breathing + 0.045, faceZ, 0, faceTilt);
        this.setPart(this.meshes.facePupils, index, this.x[index], baseY, this.z[index], yaw, 0, headY + breathing + 0.045, faceZ + 0.04, 0, faceTilt);
        this.setPart(this.meshes.faceMouth, index, this.x[index], baseY, this.z[index], yaw, 0, headY + breathing - 0.085, faceZ + 0.026, 0, faceTilt);
        this.setPart(this.meshes.penis, index, this.x[index], baseY, this.z[index], yaw, 0, crouch ? 0.5 : 0.74, 0.25, Math.PI / 2);
        this.setPart(this.meshes.leftButtock, index, this.x[index], baseY, this.z[index], yaw, -0.13, crouch ? 0.53 : 0.76, -0.17, 0, 0, 0.9, 1.05, 0.72);
        this.setPart(this.meshes.rightButtock, index, this.x[index], baseY, this.z[index], yaw, 0.13, crouch ? 0.53 : 0.76, -0.17, 0, 0, 0.9, 1.05, 0.72);
        if (detailed) {
          this.setPart(this.meshes.leftLeg, index, this.x[index], baseY, this.z[index], yaw, -0.15, legY, 0, stride * strideAmount + (crouch ? 0.62 : 0));
          this.setPart(this.meshes.rightLeg, index, this.x[index], baseY, this.z[index], yaw, 0.15, legY, 0, -stride * strideAmount + (crouch ? 0.62 : 0));
          const armPitch = shooting ? 1.16 : swording ? 0.86 + swordSwing * 0.52 : 0;
          this.setPart(this.meshes.leftArm, index, this.x[index], baseY, this.z[index], yaw, -0.34, crouch ? 0.94 : 1.12, 0.04, (shooting || swording) ? armPitch : -stride * 0.34, -0.08);
          this.setPart(this.meshes.rightArm, index, this.x[index], baseY, this.z[index], yaw, 0.34, crouch ? 0.94 : 1.12, 0.04, (shooting || swording) ? armPitch - recoil * 0.18 : stride * 0.34, 0.08);
          this.setPart(this.meshes.rifle, index, this.x[index], baseY, this.z[index], yaw, 0.14, crouch ? 1.04 : 1.3, 0.4 - recoil * 0.13, shooting ? -0.05 : 0.18, 0.62, 0.62, 0.62);
        } else {
          for (const mesh of [this.meshes.leftLeg, this.meshes.rightLeg, this.meshes.leftArm, this.meshes.rightArm, this.meshes.rifle]) this.hidePart(mesh, index);
        }
      }

      const usesSword = this.weapon[index] === 1;
      if (usesSword) {
        this.hidePart(this.meshes.rifle, index);
        if (dead) {
          this.setPart(this.meshes.sword, index, this.x[index], baseY, this.z[index], yaw, 0.16, 0.18, 0.48, Math.PI / 2, 0.34, 0.72, 0.72, 0.72);
        } else if (prone) {
          this.setPart(this.meshes.sword, index, this.x[index], baseY, this.z[index], yaw, 0.3, 0.36, 0.78, Math.PI / 2, -0.08 + swordSwing * 1.12, 0.72, 0.72, 0.72);
        } else {
          this.setPart(this.meshes.sword, index, this.x[index], baseY, this.z[index], yaw, 0.34, crouch ? 0.74 : 0.98, 0.3, 0.03, -0.12 + swordSwing * 1.3, 0.72, 0.72, 0.72);
        }
      } else {
        this.hidePart(this.meshes.sword, index);
      }

      const shieldRaised = !dead && usesSword && this.shieldActive[index] === 1;
      const shieldX = dead ? -0.36 : shieldRaised ? -0.29 : -0.58;
      const shieldY = dead ? 0.2 : prone ? 0.38 : shieldRaised ? (crouch ? 1.08 : 1.32) : (crouch ? 0.56 : 0.68);
      const shieldZ = dead ? 0.18 : prone ? 0.42 : shieldRaised ? 0.48 : -0.08;
      const shieldRotationX = dead || prone ? Math.PI / 2 : shieldRaised ? 0.02 : -0.5;
      const shieldRotationZ = dead ? -0.34 : shieldRaised ? 0.04 : -0.28;
      const shieldLocalYaw = shieldRaised ? 0.06 : 1.05;
      this.setPart(this.meshes.shield, index, this.x[index], baseY, this.z[index], yaw, shieldX, shieldY, shieldZ, shieldRotationX, shieldRotationZ, 0.72, 0.72, 0.72, shieldLocalYaw);
      this.setPart(this.meshes.shieldStripe, index, this.x[index], baseY, this.z[index], yaw, shieldX, shieldY, shieldZ + 0.078, shieldRotationX, shieldRotationZ, 0.72, 0.72, 0.72, shieldLocalYaw);
    }
    this.activeRenderSlot = null;
    for (const mesh of Object.values(this.meshes)) {
      mesh.count = detailedCount;
      mesh.instanceMatrix.needsUpdate = true;
    }
    for (const key of ['torso', 'leftLeg', 'rightLeg', 'leftArm', 'rightArm', 'shieldStripe']) this.meshes[key].instanceColor.needsUpdate = true;
    for (const mesh of Object.values(this.simplifiedMeshes)) {
      mesh.count = simplifiedCount;
      mesh.instanceMatrix.needsUpdate = true;
    }
    this.simplifiedMeshes.body.instanceColor.needsUpdate = true;
    this.renderedDetailedCount = detailedCount;
    this.renderedSimplifiedCount = simplifiedCount;
  }

  update(delta, cameraPosition, playerTarget = null, focus = null) {
    this.listenerX = cameraPosition.x;
    this.listenerY = cameraPosition.y;
    this.listenerZ = cameraPosition.z;
    this.playerTarget = playerTarget;
    this.focus = focus;
    this.aiAccumulator = Math.min(0.2, this.aiAccumulator + delta);
    const aiStep = 1 / this.profile.aiHz;
    while (this.aiAccumulator >= aiStep) {
      this.simulate(aiStep);
      this.aiAccumulator -= aiStep;
    }
    this.animationAccumulator += delta;
    const animationStep = 1 / this.profile.animationHz;
    if (this.animationAccumulator >= animationStep) {
      this.updateInstanceMatrices(cameraPosition, false, focus);
      this.animationAccumulator %= animationStep;
    }
  }

  getAliveCounts() {
    let red = 0;
    let blue = 0;
    for (let index = 0; index < this.count; index += 1) {
      if (this.dead[index]) continue;
      if (this.team[index] === 0) red += 1;
      else blue += 1;
    }
    return { red, blue };
  }

  getFortCounts(fort) {
    let red = 0;
    let blue = 0;
    const radius = fort.half - 2;
    for (let index = 0; index < this.count; index += 1) {
      if (this.dead[index]) continue;
      if (Math.abs(this.x[index] - fort.x) <= radius && Math.abs(this.z[index] - fort.z) <= radius) {
        if (this.team[index] === 0) red += 1;
        else blue += 1;
      }
    }
    return { red, blue };
  }

  getAreaCounts(x, z, radius) {
    let red = 0;
    let blue = 0;
    const radiusSquared = radius * radius;
    for (let index = 0; index < this.count; index += 1) {
      if (this.dead[index]) continue;
      const deltaX = this.x[index] - x;
      const deltaZ = this.z[index] - z;
      if (deltaX * deltaX + deltaZ * deltaZ > radiusSquared) continue;
      if (this.team[index] === 0) red += 1;
      else blue += 1;
    }
    return { red, blue };
  }

  forEachMapAgent(callback) {
    for (let index = 0; index < this.count; index += 1) {
      if (this.dead[index]) continue;
      const shooting = this.action[index] === 1;
      const stanceCycle = Math.sin(index * 3.17 + this.simulationTime * 0.31);
      const stance = !shooting && stanceCycle > 0.955
        ? 'prone'
        : shooting || stanceCycle < -0.78
          ? 'crouch'
          : 'stand';
      callback(this.x[index], this.z[index], this.team[index] === 0 ? 'red' : 'blue', index, stance);
    }
  }

  collidesCircle(x, z, radius = 0.42) {
    const minimumDistanceSquared = (radius + 0.27) ** 2;
    for (let index = 0; index < this.count; index += 1) {
      if (this.dead[index]) continue;
      const dx = x - this.x[index];
      const dz = z - this.z[index];
      if (dx * dx + dz * dz < minimumDistanceSquared) return true;
    }
    return false;
  }

  getNearbyLabels(cameraPosition, maximum = 28, range = 78) {
    const rangeSquared = range * range;
    const nearby = [];
    for (let index = 0; index < this.count; index += 1) {
      if (this.dead[index]) continue;
      const dx = this.x[index] - cameraPosition.x;
      const dy = this.y[index] + 2.15 - cameraPosition.y;
      const dz = this.z[index] - cameraPosition.z;
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      if (distanceSquared > rangeSquared) continue;
      nearby.push({
        index,
        x: this.x[index],
        y: this.y[index] + 2.18,
        z: this.z[index],
        team: this.team[index] === 0 ? 'red' : 'blue',
        name: this.names[index],
        countryCode: this.countryCodes[index],
        health: Math.max(0, this.health[index]),
        distanceSquared,
      });
    }
    nearby.sort((a, b) => a.distanceSquared - b.distanceSquared);
    return nearby.slice(0, maximum);
  }

  getLabelTargetOnRay(origin, direction, range = 82) {
    let best = null;
    let bestDistance = range;
    for (let index = 0; index < this.count; index += 1) {
      if (this.dead[index]) continue;
      const baseX = this.x[index];
      const baseY = this.y[index];
      const baseZ = this.z[index];
      for (const [height, radius] of [[1.72, 0.26], [1.06, 0.36], [0.42, 0.31]]) {
        const dx = baseX - origin.x;
        const dy = baseY + height - origin.y;
        const dz = baseZ - origin.z;
        const distanceAlongRay = dx * direction.x + dy * direction.y + dz * direction.z;
        if (distanceAlongRay <= 0 || distanceAlongRay >= bestDistance) continue;
        const perpendicularSquared = dx * dx + dy * dy + dz * dz - distanceAlongRay * distanceAlongRay;
        if (perpendicularSquared > radius * radius) continue;
        bestDistance = distanceAlongRay;
        best = {
          index,
          x: baseX,
          y: baseY + 2.18,
          baseY,
          z: baseZ,
          team: this.team[index] === 0 ? 'red' : 'blue',
          name: this.names[index],
          countryCode: this.countryCodes[index],
          health: Math.max(0, this.health[index]),
          rayDistance: distanceAlongRay,
        };
      }
    }
    return best;
  }

  getAgentInfo(index) {
    if (index == null || index < 0 || index >= this.count) return null;
    return {
      index,
      name: this.names[index],
      countryCode: this.countryCodes[index],
      team: this.team[index] === 0 ? 'red' : 'blue',
      health: Math.max(0, this.health[index]),
      weapon: this.weapon[index] === 1 ? 'sword' : 'rifle',
      shieldActive: this.weapon[index] === 1 && this.shieldActive[index] === 1,
      score: this.score[index],
      kills: this.kills[index],
      deaths: this.playerDeaths[index],
      elapsedSeconds: this.elapsedSeconds[index],
    };
  }

  raycastSegment(previous, current, attackerTeam, radiusScale = 1) {
    const travelX = current.x - previous.x;
    const travelY = current.y - previous.y;
    const travelZ = current.z - previous.z;
    const lengthSquared = travelX * travelX + travelY * travelY + travelZ * travelZ;
    if (lengthSquared < 0.00001) return null;
    let best = null;
    let bestT = Infinity;
    for (let index = 0; index < this.count; index += 1) {
      if (this.dead[index] || (this.team[index] === 0 ? 'red' : 'blue') === attackerTeam) continue;
      for (const [height, radius, damageZone] of [[1.72, 0.24, 'head'], [1.05, 0.34, 'torso'], [0.43, 0.29, 'limb']]) {
        const centerX = this.x[index];
        const centerY = this.y[index] + height;
        const centerZ = this.z[index];
        const t = THREE.MathUtils.clamp(
          ((centerX - previous.x) * travelX + (centerY - previous.y) * travelY + (centerZ - previous.z) * travelZ) / lengthSquared,
          0,
          1,
        );
        const closestX = previous.x + travelX * t;
        const closestY = previous.y + travelY * t;
        const closestZ = previous.z + travelZ * t;
        const distanceSquared = (centerX - closestX) ** 2 + (centerY - closestY) ** 2 + (centerZ - closestZ) ** 2;
        if (distanceSquared < (radius * radiusScale) ** 2 && t < bestT) {
          bestT = t;
          best = {
            massIndex: index,
            damageZone,
            targetName: this.names[index],
            point: new THREE.Vector3(closestX, closestY, closestZ),
            normal: new THREE.Vector3(-travelX, -travelY, -travelZ).normalize(),
          };
        }
      }
    }
    return best;
  }

  findMeleeTarget(origin, direction, attackerTeam, maximumDistance = 3.6, maximumAngle = 0.42) {
    const cosineThreshold = Math.cos(maximumAngle);
    let best = null;
    let bestScore = Infinity;
    for (let index = 0; index < this.count; index += 1) {
      if (this.dead[index] || (this.team[index] === 0 ? 'red' : 'blue') === attackerTeam) continue;
      const dx = this.x[index] - origin.x;
      const dy = this.y[index] + 1.02 - origin.y;
      const dz = this.z[index] - origin.z;
      const distance = Math.hypot(dx, dy, dz);
      if (distance > maximumDistance || distance < 0.01) continue;
      const alignment = (dx * direction.x + dy * direction.y + dz * direction.z) / distance;
      if (alignment < cosineThreshold) continue;
      const score = distance + (1 - alignment) * 4;
      if (score < bestScore) {
        bestScore = score;
        best = {
          massIndex: index,
          damageZone: 'torso',
          targetName: this.names[index],
          point: new THREE.Vector3(this.x[index], this.y[index] + 1.02, this.z[index]),
        };
      }
    }
    return best;
  }

  damageAgent(index, damage = 45, zone = 'torso') {
    if (index == null || this.dead[index]) return { hit: false, killed: false, damage: 0, health: 0, name: '' };
    const appliedDamage = Math.min(this.health[index], Math.max(1, Math.round(damage)));
    this.health[index] = Math.max(0, this.health[index] - appliedDamage);
    this.action[index] = 2;
    this.actionTime[index] = 0.24;
    let killed = false;
    if (this.health[index] <= 0) {
      this.dead[index] = 1;
      this.deadTimer[index] = 3;
      this.action[index] = 3;
      this.deaths[this.team[index]] += 1;
      this.playerDeaths[index] += 1;
      this.score[index] = Math.max(0, this.score[index] - 25);
      killed = true;
    }
    return {
      hit: true,
      killed,
      damage: appliedDamage,
      health: this.health[index],
      name: this.names[index],
      countryCode: this.countryCodes[index],
      team: this.team[index] === 0 ? 'red' : 'blue',
      zone,
    };
  }

  recordPlayerKill(index) {
    if (index == null || index < 0 || index >= this.count) return;
    this.kills[index] += 1;
    this.score[index] += 100;
  }

  getLeaderboardEntries(maximum = 12) {
    const entries = [];
    for (let index = 0; index < this.count; index += 1) {
      entries.push({
        name: this.names[index],
        countryCode: this.countryCodes[index],
        team: this.team[index] === 0 ? 'red' : 'blue',
        score: this.score[index],
        kills: this.kills[index],
        deaths: this.playerDeaths[index],
        elapsedSeconds: this.elapsedSeconds[index],
        dead: Boolean(this.dead[index]),
      });
    }
    entries.sort((a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths);
    return entries.slice(0, maximum);
  }

  countAheadOf(score, kills = 0, deaths = 0) {
    let ahead = 0;
    for (let index = 0; index < this.count; index += 1) {
      if (
        this.score[index] > score ||
        (this.score[index] === score && this.kills[index] > kills) ||
        (this.score[index] === score && this.kills[index] === kills && this.playerDeaths[index] < deaths)
      ) ahead += 1;
    }
    return ahead;
  }

  getMetrics() {
    const alive = this.getAliveCounts();
    return {
      total: this.count,
      red: alive.red,
      blue: alive.blue,
      shots: this.shots,
      deaths: { red: this.deaths[0], blue: this.deaths[1] },
      aiHz: this.profile.aiHz,
      animationHz: this.profile.animationHz,
      quality: this.quality,
      drawCalls: Object.keys(this.meshes).length + Object.keys(this.simplifiedMeshes).length,
      detailedRendered: this.renderedDetailedCount || 0,
      simplifiedRendered: this.renderedSimplifiedCount || 0,
    };
  }
}

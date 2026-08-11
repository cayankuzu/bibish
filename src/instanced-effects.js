import * as THREE from 'three';

const ZERO_SCALE = new THREE.Vector3(0, 0, 0);
const UNIT_SCALE = new THREE.Vector3(1, 1, 1);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function initializeHidden(mesh, capacity) {
  const matrix = new THREE.Matrix4().makeScale(0, 0, 0);
  const white = new THREE.Color(0xffffff);
  for (let i = 0; i < capacity; i += 1) {
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, white);
  }
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.frustumCulled = false;
}

export class PaintPool {
  constructor(scene, capacity = 1600, options = {}) {
    this.capacity = capacity;
    this.limit = capacity;
    this.count = 0;
    this.cursor = 0;
    this.offset = options.offset ?? 0.045;
    this.dummy = new THREE.Object3D();
    this.mesh = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 12),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: options.opacity ?? 0.82,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        side: THREE.DoubleSide,
      }),
      capacity,
    );
    this.mesh.renderOrder = options.renderOrder ?? 1;
    initializeHidden(this.mesh, capacity);
    scene.add(this.mesh);
  }

  setLimit(limit) {
    this.limit = Math.max(64, Math.min(this.capacity, Math.floor(limit)));
    this.count = Math.min(this.count, this.limit);
    this.cursor %= this.limit;
  }

  add(point, normal, radius, color) {
    const index = this.count < this.limit ? this.count++ : this.cursor;
    this.cursor = (index + 1) % this.limit;
    this.dummy.position.copy(point).addScaledVector(normal, this.offset);
    this.dummy.quaternion.setFromUnitVectors(Z_AXIS, normal);
    this.dummy.rotation.z += Math.random() * Math.PI;
    this.dummy.scale.setScalar(radius);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(index, this.dummy.matrix);
    this.mesh.setColorAt(index, new THREE.Color(color));
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    return index;
  }

  hide(index) {
    if (index < 0 || index >= this.capacity) return;
    this.dummy.position.set(0, -1000, 0);
    this.dummy.quaternion.identity();
    this.dummy.scale.copy(ZERO_SCALE);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(index, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

class TimedInstancePool {
  constructor(mesh, capacity) {
    this.mesh = mesh;
    this.capacity = capacity;
    this.slots = Array.from({ length: capacity }, () => ({ active: false }));
    this.cursor = 0;
    this.dummy = new THREE.Object3D();
    initializeHidden(mesh, capacity);
  }

  acquire() {
    for (let offset = 0; offset < this.capacity; offset += 1) {
      const index = (this.cursor + offset) % this.capacity;
      if (!this.slots[index].active) {
        this.cursor = (index + 1) % this.capacity;
        return { slot: this.slots[index], index };
      }
    }
    const index = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    return { slot: this.slots[index], index };
  }

  hide(index, slot) {
    slot.active = false;
    this.dummy.position.set(0, -1000, 0);
    this.dummy.quaternion.identity();
    this.dummy.scale.copy(ZERO_SCALE);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(index, this.dummy.matrix);
  }

  commit() {
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export class BeamPool extends TimedInstancePool {
  constructor(scene, capacity = 48) {
    const mesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(1, 1.4, 1, 6),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.82, depthWrite: false }),
      capacity,
    );
    super(mesh, capacity);
    scene.add(mesh);
  }

  add(start, end, color, radius, life) {
    const { slot, index } = this.acquire();
    slot.active = true;
    slot.life = life;
    slot.maxLife = life;
    slot.start = slot.start?.copy(start) || start.clone();
    slot.end = slot.end?.copy(end) || end.clone();
    slot.radius = radius;
    slot.color = color;
    this.mesh.setColorAt(index, new THREE.Color(color));
    this.updateSlot(index, slot);
    this.commit();
  }

  updateSlot(index, slot) {
    const direction = slot.end.clone().sub(slot.start);
    const length = direction.length();
    const fade = Math.max(0.05, slot.life / slot.maxLife);
    this.dummy.position.copy(slot.start).add(slot.end).multiplyScalar(0.5);
    this.dummy.quaternion.setFromUnitVectors(Y_AXIS, direction.normalize());
    this.dummy.scale.set(slot.radius * fade, length, slot.radius * fade);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(index, this.dummy.matrix);
  }

  update(delta) {
    let changed = false;
    for (let i = 0; i < this.capacity; i += 1) {
      const slot = this.slots[i];
      if (!slot.active) continue;
      changed = true;
      slot.life -= delta;
      if (slot.life <= 0) this.hide(i, slot);
      else this.updateSlot(i, slot);
    }
    if (changed) this.commit();
  }
}

export class GlobPool extends TimedInstancePool {
  constructor(scene, capacity = 180) {
    const mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial(),
      capacity,
    );
    super(mesh, capacity);
    scene.add(mesh);
  }

  add(start, end, color, size = 0.18, options = {}) {
    const { slot, index } = this.acquire();
    slot.active = true;
    slot.duration = THREE.MathUtils.clamp(Number(options.duration) || 0.3, 0.08, 1.2);
    slot.delay = THREE.MathUtils.clamp(Number(options.delay) || 0, 0, 0.45);
    slot.age = -slot.delay;
    slot.life = slot.duration + slot.delay;
    slot.maxLife = slot.life;
    slot.start = slot.start?.copy(start) || start.clone();
    slot.end = slot.end?.copy(end) || end.clone();
    slot.size = size;
    slot.arcHeight = Number.isFinite(Number(options.arcHeight)) ? Number(options.arcHeight) : 0.35;
    slot.gravityDrop = Math.max(0, Number(options.gravityDrop) || 0);
    slot.endScale = THREE.MathUtils.clamp(Number(options.endScale) || 0.25, 0.08, 1);
    this.mesh.setColorAt(index, new THREE.Color(color));
    this.commit();
  }

  update(delta) {
    let changed = false;
    for (let i = 0; i < this.capacity; i += 1) {
      const slot = this.slots[i];
      if (!slot.active) continue;
      changed = true;
      slot.age += delta;
      slot.life = slot.duration - slot.age;
      if (slot.age < 0) {
        this.dummy.position.copy(slot.start);
        this.dummy.quaternion.identity();
        this.dummy.scale.copy(ZERO_SCALE);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      if (slot.age >= slot.duration) {
        this.hide(i, slot);
        continue;
      }
      const t = THREE.MathUtils.clamp(slot.age / slot.duration, 0, 1);
      this.dummy.position.lerpVectors(slot.start, slot.end, t);
      this.dummy.position.y += Math.sin(t * Math.PI) * slot.arcHeight - t * t * slot.gravityDrop;
      this.dummy.quaternion.identity();
      this.dummy.scale.setScalar(slot.size * THREE.MathUtils.lerp(1, slot.endScale, t));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    if (changed) this.commit();
  }
}

export class BallisticPool extends TimedInstancePool {
  constructor(scene, capacity = 64) {
    const mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.04 }),
      capacity,
    );
    mesh.castShadow = true;
    super(mesh, capacity);
    scene.add(mesh);
  }

  fire(position, velocity, color, size = 0.13, gravity = 9.81, drag = 0.04) {
    const { slot, index } = this.acquire();
    slot.active = true;
    slot.life = 4;
    slot.position = slot.position?.copy(position) || position.clone();
    slot.previous = slot.previous?.copy(position) || position.clone();
    slot.velocity = slot.velocity?.copy(velocity) || velocity.clone();
    slot.size = size;
    slot.gravity = gravity;
    slot.drag = Math.max(0, Number(drag) || 0);
    slot.travelDistance = 0;
    slot.color = slot.color?.set(color) || new THREE.Color(color);
    this.mesh.setColorAt(index, slot.color);
    this.commit();
  }

  update(delta, collisionTest, onImpact, onTrail = null) {
    let changed = false;
    for (let index = 0; index < this.capacity; index += 1) {
      const slot = this.slots[index];
      if (!slot.active) continue;
      changed = true;
      slot.life -= delta;
      slot.previous.copy(slot.position);
      // Paintball yüksek çıkış hızında ilk bölümde neredeyse düz gider, uzakta doğal olarak düşer.
      // Exact integration for linear aerodynamic drag plus gravity. This keeps
      // speed loss and drop consistent across different frame rates.
      if (slot.drag > 0.00001) {
        const attenuation = Math.exp(-slot.drag * delta);
        const velocityScale = (1 - attenuation) / slot.drag;
        const gravityPositionScale = delta / slot.drag - (1 - attenuation) / (slot.drag * slot.drag);
        slot.position.addScaledVector(slot.velocity, velocityScale);
        slot.position.y -= slot.gravity * gravityPositionScale;
        slot.velocity.multiplyScalar(attenuation);
        slot.velocity.y -= slot.gravity * velocityScale;
      } else {
        slot.position.addScaledVector(slot.velocity, delta);
        slot.position.y -= slot.gravity * delta * delta * 0.5;
        slot.velocity.y -= slot.gravity * delta;
      }
      slot.travelDistance += slot.previous.distanceTo(slot.position);
      const hit = collisionTest(slot.previous, slot.position);
      if (hit) {
        onTrail?.(slot.previous, hit.point || slot.position, slot.color);
        hit.travelDistance = slot.travelDistance;
        hit.impactSpeed = slot.velocity.length();
        onImpact(hit);
        this.hide(index, slot);
        continue;
      }
      onTrail?.(slot.previous, slot.position, slot.color);
      if (slot.life <= 0 || slot.position.y < -30) {
        this.hide(index, slot);
        continue;
      }
      this.dummy.position.copy(slot.position);
      this.dummy.quaternion.identity();
      this.dummy.scale.setScalar(slot.size);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(index, this.dummy.matrix);
    }
    if (changed) this.commit();
  }
}

export class PoopPool extends TimedInstancePool {
  constructor(scene, capacity = 48) {
    const poopProfile = [
      [0.02, 0], [0.72, 0.02], [0.98, 0.22], [0.9, 0.48],
      [0.58, 0.58], [0.76, 0.78], [0.66, 1.02], [0.38, 1.14],
      [0.48, 1.32], [0.3, 1.5], [0.06, 1.66],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const mesh = new THREE.InstancedMesh(
      new THREE.LatheGeometry(poopProfile, 10),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }),
      capacity,
    );
    mesh.castShadow = true;
    super(mesh, capacity);
    scene.add(mesh);
  }

  fire(position, velocity, color = 0x4c2c18) {
    const { slot, index } = this.acquire();
    slot.active = true;
    slot.mode = 'projectile';
    slot.life = 6;
    slot.position = slot.position?.copy(position) || position.clone();
    slot.previous = slot.previous?.copy(position) || position.clone();
    slot.velocity = slot.velocity?.copy(velocity) || velocity.clone();
    slot.rotation = 0;
    slot.bounceCount = 0;
    this.mesh.setColorAt(index, new THREE.Color(color));
    this.commit();
  }

  update(delta, collisionTest, onImpact) {
    let changed = false;
    for (let i = 0; i < this.capacity; i += 1) {
      const slot = this.slots[i];
      if (!slot.active) continue;
      changed = true;
      slot.life -= delta;

      if (slot.mode === 'projectile') {
        slot.previous.copy(slot.position);
        slot.velocity.y -= 19 * delta;
        slot.position.addScaledVector(slot.velocity, delta);
        slot.rotation += delta * 5;
        const hit = collisionTest(slot.previous, slot.position, slot.life);
        if (hit) {
          if (hit.bounce) {
            slot.bounceCount += 1;
            slot.position.copy(hit.point).addScaledVector(hit.normal, 0.16);
            slot.velocity.reflect(hit.normal).multiplyScalar(0.58);
            slot.velocity.addScaledVector(hit.normal, 1.2);
          } else {
            onImpact(hit.point, hit.normal);
            // The intact projectile disappears on impact; the caller creates
            // separate tumbling chunks and ground splatters from the hit point.
            this.hide(i, slot);
            continue;
          }
        }
      }

      if (slot.life <= 0) {
        this.hide(i, slot);
        continue;
      }

      this.dummy.position.copy(slot.position);
      this.dummy.quaternion.setFromAxisAngle(Z_AXIS, slot.rotation || 0);
      if (slot.mode === 'pile') this.dummy.scale.set(0.85, 0.38, 0.85);
      else this.dummy.scale.setScalar(0.62);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    if (changed) this.commit();
  }
}

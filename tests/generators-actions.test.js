import { expect } from 'chai';
import { javascriptGenerator } from 'blockly/javascript';
import { registerAnimateGenerators } from '../generators/generators-animate.js';
import { registerSceneGenerators } from '../generators/generators-scene.js';

export function runActionGeneratorTests() {
  describe('generators/generators-actions @actiongenerators', function () {
    let originalNameDB;

    before(function () {
      registerAnimateGenerators(javascriptGenerator);
      registerSceneGenerators(javascriptGenerator);
    });

    beforeEach(function () {
      originalNameDB = javascriptGenerator.nameDB_;
      javascriptGenerator.nameDB_ = { getName: (name) => name };
    });

    afterEach(function () {
      javascriptGenerator.nameDB_ = originalNameDB;
    });

    const generate = (type, nameField, name, action) =>
      javascriptGenerator.forBlock[type]({
        getFieldValue: (field) => (field === 'ACTION' ? action : field === nameField ? name : null),
      });

    const cases = [
      ['control_animation_group', 'GROUP_NAME', 'AnimationGroup', ['play', 'pause', 'stop']],
      ['control_particle_system', 'SYSTEM_NAME', 'ParticleSystem', ['start', 'stop', 'reset']],
    ];

    for (const [type, nameField, suffix, actions] of cases) {
      describe(type, function () {
        for (const action of actions) {
          it(`should call ${action}${suffix} for ${action}`, function () {
            expect(generate(type, nameField, 'thing', action)).to.equal(
              `${action}${suffix}(thing);\n`
            );
          });
        }

        it('should emit nothing for an action that is not an option', function () {
          expect(generate(type, nameField, 'thing', 'alert(1);play')).to.equal('');
        });
      });
    }
  });
}

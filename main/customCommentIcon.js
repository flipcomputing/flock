import * as Blockly from "blockly";

export class CustomCommentIcon extends Blockly.icons.CommentIcon {
        constructor(sourceBlock) {
                super(sourceBlock);
        }

        initView(pointerdownListener) {
                if (this.svgRoot) return;

                super.initView(pointerdownListener);

                while (this.svgRoot.firstChild) {
                        this.svgRoot.removeChild(this.svgRoot.firstChild);
                }

                const iconGroup = Blockly.utils.dom.createSvgElement(
                        Blockly.utils.Svg.G,
                        {
                                class: "blocklyCommentIconGroup",
                                transform: "translate(0, 0)",
                        },
                        this.svgRoot
                );

                Blockly.utils.dom.createSvgElement(
                        Blockly.utils.Svg.PATH,
                        {
                                class: "blocklyCommentIconPath",
                                d: "M64 480c-35.3 0-64-28.7-64-64L0 96C0 60.7 28.7 32 64 32l320 0c35.3 0 64 28.7 64 64l0 213.5c0 17-6.7 33.3-18.7 45.3L322.7 461.3c-12 12-28.3 18.7-45.3 18.7L64 480zM389.5 304L296 304c-13.3 0-24 10.7-24 24l0 93.5 117.5-117.5z",
                                transform: "scale(0.046) translate(1, 1)",
                        },
                        iconGroup
                );
        }

        getSize() {
                return new Blockly.utils.Size(22, 24);
        }
}

export function registerCustomCommentIcon() {
        Blockly.icons.registry.unregister("comment");
        Blockly.icons.registry.register(
                Blockly.icons.IconType.COMMENT,
                CustomCommentIcon
        );
}

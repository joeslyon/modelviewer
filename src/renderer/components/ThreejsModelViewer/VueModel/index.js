import ModelStl from './model-stl.vue'
import ModelPly from './model-ply.vue'
import ModelCollada from './model-collada.vue'
import ModelGltf from './model-gltf.vue'


const components = [
    ModelStl,
    ModelPly,
    ModelCollada,
    ModelGltf,
]

const install = ( Vue ) => {
    components.map( component => {
        Vue.component( component.name, component );
    } );
}

if ( typeof window !== 'undefined' && window.Vue ) {
    install( window.Vue );
}

export default {
    install,
    ModelStl,
    ModelPly,
    ModelCollada,
    ModelGltf,
}

export {
    install,
    ModelStl,
    ModelPly,
    ModelCollada,
    ModelGltf,
}

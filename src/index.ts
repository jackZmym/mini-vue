import { effect, reactive, stop } from './reactivity';
import { readonly } from './reactivity/reactive';
const obsered = (window.obsered = reactive({ num: 1 }));
// const muObsered = (window.muObsered = reactive({ num: 10 }));
// const muObsered = (window.muObsered = readonly(obsered));
const runner = effect(
    () => {
        // effect(
        //     () => {
        //         console.log(muObsered.num, '内层的');

        //         return '内层';
        //     },
        //     {
        //         onStop: () => {}
        //     }
        // );
        if (obsered.num !== 1) {
            stop(runner);
        }
        console.log('外层的');
        // stop(runner);
        // return '外层';
    },
    {
        wonStop: () => {}
    }
);

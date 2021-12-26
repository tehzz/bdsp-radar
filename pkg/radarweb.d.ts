declare namespace wasm_bindgen {
	/* tslint:disable */
	/* eslint-disable */
	/**
	* @param {Config} config
	* @param {number} target
	* @returns {Float64Array}
	*/
	export function run_shiny_mc_single_chain(config: Config, target: number): Float64Array;
	/**
	*/
	export class Config {
	  free(): void;
	/**
	*/
	  constructor();
	/**
	*/
	  chain_max: number;
	/**
	*/
	  chain_start: number;
	/**
	*/
	  pkmn_wildrate: number;
	/**
	*/
	  sample_size: number;
	/**
	*/
	  time_for_catch: number;
	/**
	*/
	  time_for_reroll: number;
	/**
	*/
	  time_for_run: number;
	/**
	*/
	  total_shinies: number;
	}
	
}

declare type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

declare interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly run_shiny_mc_single_chain: (a: number, b: number, c: number) => void;
  readonly __wbg_config_free: (a: number) => void;
  readonly __wbg_get_config_chain_start: (a: number) => number;
  readonly __wbg_set_config_chain_start: (a: number, b: number) => void;
  readonly __wbg_get_config_chain_max: (a: number) => number;
  readonly __wbg_set_config_chain_max: (a: number, b: number) => void;
  readonly __wbg_get_config_sample_size: (a: number) => number;
  readonly __wbg_set_config_sample_size: (a: number, b: number) => void;
  readonly __wbg_get_config_total_shinies: (a: number) => number;
  readonly __wbg_set_config_total_shinies: (a: number, b: number) => void;
  readonly __wbg_get_config_pkmn_wildrate: (a: number) => number;
  readonly __wbg_set_config_pkmn_wildrate: (a: number, b: number) => void;
  readonly __wbg_get_config_time_for_catch: (a: number) => number;
  readonly __wbg_set_config_time_for_catch: (a: number, b: number) => void;
  readonly __wbg_get_config_time_for_run: (a: number) => number;
  readonly __wbg_set_config_time_for_run: (a: number, b: number) => void;
  readonly __wbg_get_config_time_for_reroll: (a: number) => number;
  readonly __wbg_set_config_time_for_reroll: (a: number, b: number) => void;
  readonly config_new_web: () => number;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_free: (a: number, b: number) => void;
  readonly __wbindgen_exn_store: (a: number) => void;
}

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
declare function wasm_bindgen (module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;

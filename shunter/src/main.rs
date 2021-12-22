use pokeradar::Config;
fn main() -> Result<(), pokeradar::RadarError> {
    let config = Config {
        sample_size: 30_000,
        pkmn_wildrate: 10_0,
        total_shinies: 1,
        ..Default::default()
    };
    println!(
        "staring run of {} iterations up to chain of {} @ {:.1}% encounter rate for {} shin{}",
        config.sample_size,
        config.chain_max,
        config.pkmn_wildrate as f32 / 10.,
        config.total_shinies,
        if config.total_shinies > 1 { "ies" } else { "y" }
    );
    let run = pokeradar::find_shiny(config)?;

    for (run, p) in run.into_iter().enumerate() {
        println!(
            "{}\t{:.2} min |{:.2}---[{:.2} to {:.2}]---{:.2}|",
            run,
            p.q50 / 60.,
            p.q09 / 60.,
            p.q25 / 60.,
            p.q75 / 60.,
            p.q91 / 60.
        );
    }

    Ok(())
}

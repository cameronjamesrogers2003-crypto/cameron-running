export class Pace {
  private readonly _secondsPerKm: number;

  private constructor(secondsPerKm: number) {
    if (secondsPerKm <= 0) {
      // Clamp to a sensible minimum of 1 second per km instead of throwing,
      // in case of 0 initialization from empty data.
      this._secondsPerKm = 1;
    } else {
      this._secondsPerKm = secondsPerKm;
    }
  }

  public static fromSecondsPerKm(seconds: number): Pace {
    return new Pace(seconds);
  }

  public static fromMinutesPerKm(minutes: number, seconds: number): Pace {
    return new Pace(minutes * 60 + seconds);
  }

  public get asSecondsPerKm(): number {
    return this._secondsPerKm;
  }

  public get asMetersPerSecond(): number {
    return 1000 / this._secondsPerKm;
  }

  public get formattedMinPerKm(): string {
    const mins = Math.floor(this._secondsPerKm / 60);
    const secs = Math.round(this._secondsPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}/km`;
  }

  public get asSecondsPerMile(): number {
    return this._secondsPerKm * 1.60934;
  }

  public get formattedMinPerMile(): string {
    const spm = this.asSecondsPerMile;
    const mins = Math.floor(spm / 60);
    const secs = Math.round(spm % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}/mi`;
  }

  public toString(): string {
    return this.formattedMinPerKm;
  }
}

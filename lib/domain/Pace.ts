export class Pace {
  private readonly _secondsPerKm: number;

  private constructor(secondsPerKm: number) {
    if (secondsPerKm < 0) {
      throw new Error("Pace cannot be negative.");
    }
    this._secondsPerKm = secondsPerKm;
  }

  public static fromSecondsPerKm(seconds: number): Pace {
    return new Pace(seconds);
  }

  public static fromMinutesAndSeconds(minutes: number, seconds: number): Pace {
    return new Pace(minutes * 60 + seconds);
  }

  public get secondsPerKm(): number {
    return this._secondsPerKm;
  }

  public get minPerKm(): string {
    if (this._secondsPerKm === 0) return "0:00";
    const mins = Math.floor(this._secondsPerKm / 60);
    const secs = Math.round(this._secondsPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  public get minutesPerKm(): number {
    return this._secondsPerKm / 60;
  }

  public get metersPerSecond(): number {
    if (this._secondsPerKm === 0) return 0;
    return 1000 / this._secondsPerKm;
  }

  public get milesPerHour(): number {
    if (this._secondsPerKm === 0) return 0;
    // 1 km = 0.621371 miles
    // secondsPerKm -> hoursPerKm = secondsPerKm / 3600
    // milesPerHour = miles / hour
    const hoursPerKm = this._secondsPerKm / 3600;
    return 0.621371 / hoursPerKm;
  }
}

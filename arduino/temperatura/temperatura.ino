
void setup() {
    Serial.begin(9600);
}

void loop() {
    float temperatura = 20.0 + random(0, 101) / 10.0;

    Serial.println(temperatura);

    delay(3000);
}

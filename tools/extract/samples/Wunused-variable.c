// FLAGS: -Wunused-variable -Wunused-parameter
int add(int a, int b) {
    int scratch = 42;
    return a + b;
}
